import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../../lib/http";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { Feedback } from "../../components/Feedback";
import { BookForm } from "./BookForm";
import { Pagination } from "../../components/Pagination";
import { loadAllCategories } from "./loadCategories";
import { errorMessage } from "./types";
import type { Book, BookInput, Category, Copy, PaginationInfo } from "./types";

function CopyRow({
  copy,
  busy,
  onUpdate,
}: {
  copy: Copy;
  busy: boolean;
  onUpdate: (id: string, condition: Copy["conditionStatus"]) => Promise<void>;
}) {
  const [condition, setCondition] = useState(copy.conditionStatus);
  return (
    <tr>
      <td>{copy.barcode}</td>
      <td>
        <label className="sr-only" htmlFor={`condition-${copy.id}`}>
          Condition for {copy.barcode}
        </label>
        <select
          id={`condition-${copy.id}`}
          value={condition}
          onChange={(event) =>
            setCondition(event.target.value as Copy["conditionStatus"])
          }
          disabled={busy}
        >
          <option value="AVAILABLE">Available for service</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="RETIRED">Retired</option>
        </select>
      </td>
      <td>
        <Button
          disabled={busy || condition === copy.conditionStatus}
          onClick={() => {
            void onUpdate(copy.id, condition);
          }}
        >
          Update condition
        </Button>
      </td>
    </tr>
  );
}

export function BookDetailPage({
  bookId,
  onNavigate,
}: {
  bookId: string;
  onNavigate: (path: string) => void;
}) {
  const { user, api } = useAuth();
  const staff = user?.role === "LIBRARIAN" || user?.role === "ADMIN";
  const [book, setBook] = useState<Book | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [copiesPage, setCopiesPage] = useState(1);
  const [copiesPagination, setCopiesPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [available, setAvailable] = useState<number | null>(null);
  const cache = useRef<{ id: string; etag: string; book: Book } | null>(null);
  const forceReload = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    if (cache.current?.id !== bookId) {
      cache.current = null;
      setBook(null);
      setAvailable(null);
      setEditing(false);
      setError("");
      setCopies([]);
      setCopiesPage(1);
    }
    const headers = new Headers();
    if (cache.current?.etag && !forceReload.current)
      headers.set("If-None-Match", cache.current.etag);
    forceReload.current = false;
    async function load() {
      const [metadata, availability] = await Promise.all([
        api.requestWithMetadata<{ data: Book }>(`/books/${bookId}`, {
          headers,
          signal: controller.signal,
        }),
        api.request<{ data: { bookId: string; availableCopies: number } }>(
          `/books/${bookId}/availability`,
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted) return;
      if (metadata.status !== 304) {
        cache.current = {
          id: bookId,
          etag:
            metadata.headers.get("ETag") ??
            `"book-${bookId}-v${metadata.data.data.version}"`,
          book: metadata.data.data,
        };
      }
      if (cache.current) setBook(cache.current.book);
      setAvailable(availability.data.availableCopies);
      if (staff) {
        const [categoryResult, copyResult] = await Promise.all([
          loadAllCategories(api, controller.signal),
          api.request<{ data: Copy[]; pagination: PaginationInfo }>(
            `/books/${bookId}/copies?page=${copiesPage}&limit=20`,
            {
              signal: controller.signal,
            },
          ),
        ]);
        if (!controller.signal.aborted) {
          setCategories(categoryResult);
          if (copiesPage > Math.max(1, copyResult.pagination.totalPages)) {
            setCopiesPage(Math.max(1, copyResult.pagination.totalPages));
          } else {
            setCopies(copyResult.data);
            setCopiesPagination(copyResult.pagination);
          }
        }
      }
    }
    void load()
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(cause));
          if (
            cause instanceof ApiError &&
            [401, 403, 404].includes(cause.problem.status)
          ) {
            cache.current = null;
            setBook(null);
            setAvailable(null);
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, bookId, staff, copiesPage, refresh]);

  function reload(force = false) {
    forceReload.current = force;
    setRefresh((value) => value + 1);
  }
  async function updateMetadata(input: BookInput) {
    if (!cache.current || conflict) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api.requestWithMetadata<{ data: Book }>(
        `/books/${bookId}`,
        {
          method: "PUT",
          headers: { "If-Match": cache.current.etag },
          json: input,
        },
      );
      cache.current = {
        id: bookId,
        etag:
          result.headers.get("ETag") ??
          `"book-${bookId}-v${result.data.data.version}"`,
        book: result.data.data,
      };
      setBook(result.data.data);
      setEditing(false);
      setMessage("Book metadata saved.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.problem.status === 412) {
        setConflict(true);
        setError(
          "This book changed while you were editing. The latest metadata is shown above your draft. Review both before saving again.",
        );
        reload(true);
      } else setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    if (!cache.current) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request<void>(`/books/${bookId}`, {
        method: "DELETE",
        headers: { "If-Match": cache.current.etag },
      });
      setArchiveConfirm(false);
      setEditing(false);
      setMessage("Book archived. Its borrowing history is preserved.");
      reload(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.problem.status === 412) {
        setArchiveConfirm(false);
        setError(
          "This book changed. Review the latest metadata before choosing archive again.",
        );
        reload(true);
      } else setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function borrow() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request("/loans", { method: "POST", json: { bookId } });
      setMessage(
        "Book borrowed successfully. You can review its due date in My loans.",
      );
      reload();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? errorMessage(cause)
          : "The borrowing result could not be confirmed. Check My loans before trying again.",
      );
      reload();
    } finally {
      setSaving(false);
    }
  }
  async function addCopy(event: FormEvent) {
    event.preventDefault();
    if (!barcode.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request(`/books/${bookId}/copies`, {
        method: "POST",
        json: { barcode: barcode.trim() },
      });
      setBarcode("");
      setMessage("Physical copy added.");
      reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function updateCopy(
    id: string,
    conditionStatus: Copy["conditionStatus"],
  ) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request(`/copies/${id}`, {
        method: "PATCH",
        json: { conditionStatus },
      });
      setMessage("Copy condition updated.");
      reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  const currentBook =
    book?.id === bookId && (!book.archivedAt || staff) ? book : null;
  return (
    <div className="stack">
      <Button onClick={() => onNavigate("/books")}>Back to catalog</Button>
      {loading && <Feedback kind="loading">Loading book details…</Feedback>}
      {error && (
        <Feedback kind="error">
          <p>{error}</p>
          {!currentBook && (
            <Button
              onClick={() => {
                setError("");
                reload(true);
              }}
            >
              Retry book
            </Button>
          )}
        </Feedback>
      )}
      {message && <Feedback kind="success">{message}</Feedback>}
      {currentBook && (
        <>
          <section className="panel stack" aria-labelledby="book-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Book details</p>
                <h1 id="book-title">{currentBook.title}</h1>
                <p className="lead">By {currentBook.author}</p>
              </div>
              <span className="badge">
                {currentBook.archivedAt
                  ? "Archived"
                  : `${available ?? "…"} available ${available === 1 ? "copy" : "copies"}`}
              </span>
            </div>
            <p>{currentBook.description || "No description available."}</p>
            <dl className="detail-grid">
              <div>
                <dt>ISBN</dt>
                <dd>{currentBook.isbn ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Metadata version</dt>
                <dd>{currentBook.version}</dd>
              </div>
              {staff && (
                <div>
                  <dt>Category</dt>
                  <dd>
                    {categories.find(
                      (category) => category.id === currentBook.categoryId,
                    )?.name ?? currentBook.categoryId}
                  </dd>
                </div>
              )}
            </dl>
            {!currentBook.archivedAt && (
              <div className="action-row">
                {!user && (
                  <Button onClick={() => onNavigate("/login")}>
                    Sign in to borrow
                  </Button>
                )}
                {user?.role === "MEMBER" && (
                  <>
                    <Button
                      busy={saving}
                      disabled={loading || available === null || available < 1}
                      onClick={() => {
                        void borrow();
                      }}
                    >
                      Borrow this book
                    </Button>
                    <Button onClick={() => onNavigate("/loans")}>
                      My loans
                    </Button>
                  </>
                )}
              </div>
            )}
            {staff && !currentBook.archivedAt && (
              <div className="action-row">
                <Button
                  disabled={saving}
                  onClick={() => {
                    setEditing((value) => !value);
                    setConflict(false);
                    setError("");
                  }}
                >
                  Edit metadata
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => setArchiveConfirm(true)}
                >
                  Archive book
                </Button>
              </div>
            )}
            {staff && archiveConfirm && (
              <div className="stack" role="group" aria-label="Confirm archive">
                <p>
                  Archive this book? It will be hidden from the public catalog.
                  Existing history is kept.
                </p>
                <div className="action-row">
                  <Button
                    busy={saving}
                    onClick={() => {
                      void archive();
                    }}
                  >
                    Confirm archive
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => setArchiveConfirm(false)}
                  >
                    Keep book active
                  </Button>
                </div>
              </div>
            )}
          </section>
          {staff && editing && !currentBook.archivedAt && (
            <section className="panel stack" aria-labelledby="edit-book-title">
              <h2 id="edit-book-title">Edit book metadata</h2>
              {conflict && (
                <Feedback kind="error">
                  <p>
                    Your draft has been kept. Compare it with the latest version
                    above.
                  </p>
                  <Button onClick={() => setConflict(false)}>
                    I reviewed the latest version
                  </Button>
                </Feedback>
              )}
              <BookForm
                initial={currentBook}
                categories={categories}
                busy={saving}
                blocked={conflict}
                submitLabel="Save book"
                onSubmit={updateMetadata}
                onCancel={() => setEditing(false)}
              />
            </section>
          )}
          {staff && (
            <section className="panel stack" aria-labelledby="copies-title">
              <h2 id="copies-title">Physical copies</h2>
              <p className="muted">
                “Available for service” describes physical condition. Live
                borrowing availability is shown separately.
              </p>
              {copies.length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Barcode</th>
                        <th scope="col">Condition</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {copies.map((copy) => (
                        <CopyRow
                          key={`${copy.id}-${copy.conditionStatus}`}
                          copy={copy}
                          busy={saving || loading}
                          onUpdate={updateCopy}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !loading && (
                  <Feedback kind="empty">
                    No physical copies have been added.
                  </Feedback>
                )
              )}
              <Pagination
                page={copiesPagination.page}
                totalPages={copiesPagination.totalPages}
                busy={saving || loading}
                onPageChange={setCopiesPage}
              />
              <p className="muted">{copiesPagination.total} physical copies</p>
              {!currentBook.archivedAt && (
                <form
                  onSubmit={(event) => {
                    void addCopy(event);
                  }}
                  className="toolbar"
                >
                  <FormField
                    label="New copy barcode"
                    value={barcode}
                    maxLength={64}
                    required
                    onChange={(event) => setBarcode(event.target.value)}
                    disabled={saving}
                  />
                  <Button type="submit" busy={saving}>
                    Add copy
                  </Button>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
