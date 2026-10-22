import { useSubmission } from "./useSubmission";
import { useRemote } from "./useRemote";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Pagination } from "../../components/Pagination";
import { ApiError, createApiClient } from "../../lib/http";
import { BookForm, ErrorNotice, SelectField } from "./Forms";
import { Categories, Copies } from "./Management";
import type { Book, Category, Page, Session } from "./types";

export function Catalog() {
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);
  const client = useMemo(() => {
    const api = createApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      getAccessToken: () => session?.accessToken ?? null,
    });
    return {
      ...api,
      async request<T>(...args: Parameters<typeof api.request<T>>) {
        try {
          return await api.request<T>(...args);
        } catch (e) {
          if (e instanceof ApiError && e.problem.status === 401 && session) {
            setSession(null);
            setExpired(true);
          }
          throw e;
        }
      },
    };
  }, [session]);
  const staff =
    session?.user.role === "ADMIN" || session?.user.role === "LIBRARIAN";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useSubmission();
  const [query, setQuery] = useState({
    q: "",
    categoryId: "",
    sort: "title",
    includeArchived: false,
    page: 1,
  });
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const changed = () => setRevision((v) => v + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archive = useSubmission();
  const detailElement = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedId)
      detailElement.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [selectedId]);
  const categoriesLoader = useCallback(
    async (signal: AbortSignal) => {
      void revision;
      const result: Category[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const r = await client.request<Page<Category>>(
          `/categories?page=${page}&limit=100`,
          { signal },
        );
        result.push(...r.data);
        totalPages = r.pagination.totalPages;
        page++;
      } while (page <= totalPages && !signal.aborted);
      return result;
    },
    [client, revision],
  );
  const { data: loadedCategories, error: categoryError } =
    useRemote(categoriesLoader);
  const categories = loadedCategories ?? [];
  const booksLoader = useCallback(
    (signal: AbortSignal) => {
      void revision;
      void session;
      const params = new URLSearchParams({
        q: query.q,
        sort: query.sort,
        page: String(query.page),
        limit: "12",
      });
      if (query.categoryId) params.set("categoryId", query.categoryId);
      if (staff && query.includeArchived) params.set("includeArchived", "true");
      return client.request<Page<Book>>(`/books?${params}`, { signal });
    },
    [client, query, revision, session, staff],
  );
  const { data: books, error, loading } = useRemote(booksLoader);
  const detailLoader = useCallback(
    async (signal: AbortSignal) => {
      void revision;
      void session;
      if (!selectedId) return undefined;
      try {
        const metadata = await client.requestWithMetadata<{ data: Book }>(
          `/books/${selectedId}`,
          { signal },
        );
        let available: number | undefined;
        if (!metadata.data.data.archivedAt)
          available = (
            await client.request<{ data: { availableCopies: number } }>(
              `/books/${selectedId}/availability`,
              { signal },
            )
          ).data.availableCopies;
        return {
          book: metadata.data.data,
          etag: metadata.headers.get("ETag")!,
          available,
        };
      } catch (e) {
        if (
          !signal.aborted &&
          e instanceof ApiError &&
          e.problem.status === 401
        ) {
          setSession(null);
          setExpired(true);
        }
        throw e;
      }
    },
    [client, selectedId, revision, session, setSession],
  );
  const { data: detail, error: detailError } = useRemote(detailLoader);
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(() => {
      setSession(null);
      setExpired(true);
    }, session.expiresIn * 1000);
    return () => clearTimeout(timeout);
  }, [session, setSession]);
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Category";
  return (
    <div className="catalog-stack">
      <section className="panel catalog-stack" aria-label="Catalog account">
        {session ? (
          <div className="section-heading">
            <p>
              Signed in as <strong>{session.user.fullName}</strong> ·{" "}
              {session.user.role}
            </p>
            <Button
              onClick={() => {
                setSession(null);
                setSelectedId(null);
              }}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <details>
            <summary>Staff sign in to manage the catalog</summary>
            <form
              className="catalog-form"
              onSubmit={(e) => {
                e.preventDefault();
                void login.submit(async () => {
                  const r = await client.request<{ data: Session }>(
                    "/auth/login",
                    { method: "POST", json: { email, password } },
                  );
                  setSession(r.data);
                  setPassword("");
                  setExpired(false);
                });
              }}
            >
              <ErrorNotice error={login.error} />
              <FormField
                label="Email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FormField
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" busy={login.busy}>
                Sign in
              </Button>
            </form>
          </details>
        )}
        {expired && (
          <Feedback kind="error">
            Your session has expired. Sign in again to manage the catalog.
          </Feedback>
        )}
      </section>
      <ErrorNotice error={categoryError} />
      {Boolean(categoryError) && (
        <Button onClick={changed}>Retry categories</Button>
      )}
      <form
        className="panel catalog-filters"
        aria-label="Search catalog"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((v) => ({ ...v, q: search, page: 1 }));
          setSelectedId(null);
        }}
      >
        <FormField
          label="Search books"
          value={search}
          maxLength={200}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title, author or ISBN"
        />
        <SelectField
          label="Filter by category"
          value={query.categoryId}
          onChange={(categoryId) => {
            setQuery((v) => ({ ...v, categoryId, page: 1 }));
            setSelectedId(null);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sort books"
          value={query.sort}
          onChange={(sort) => setQuery((v) => ({ ...v, sort, page: 1 }))}
        >
          <option value="title">Title A–Z</option>
          <option value="-title">Title Z–A</option>
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
        </SelectField>
        <Button type="submit" busy={loading}>
          Search
        </Button>
        {staff && (
          <label>
            <input
              type="checkbox"
              checked={query.includeArchived}
              onChange={(e) =>
                setQuery((v) => ({
                  ...v,
                  includeArchived: e.target.checked,
                  page: 1,
                }))
              }
            />{" "}
            Include archived books
          </label>
        )}
      </form>
      {staff && (
        <div className="catalog-actions">
          <Button
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
            }}
          >
            Add book
          </Button>
        </div>
      )}
      {creating && staff && (
        <BookForm
          categories={categories}
          cancel={() => setCreating(false)}
          save={async (body) => {
            const r = await client.request<{ data: Book }>("/books", {
              method: "POST",
              json: body,
            });
            setCreating(false);
            setSelectedId(r.data.id);
            setEditing(false);
            changed();
          }}
        />
      )}
      <ErrorNotice error={error} />
      {Boolean(error) && <Button onClick={changed}>Retry books</Button>}
      {loading ? (
        <Feedback kind="loading">Loading books…</Feedback>
      ) : !error && books?.data.length === 0 ? (
        <Feedback kind="empty">No books match your search.</Feedback>
      ) : (
        !error && (
          <>
            <p className="muted">{books?.pagination.total ?? 0} books found</p>
            <div className="catalog-grid">
              {books?.data.map((book) => (
                <article className="panel book-card" key={book.id}>
                  <span className="badge">
                    {book.archivedAt
                      ? "Archived"
                      : categoryName(book.categoryId)}
                  </span>
                  <h2>{book.title}</h2>
                  <p>{book.author}</p>
                  <small>{book.isbn ? `ISBN ${book.isbn}` : "No ISBN"}</small>
                  <Button
                    onClick={() => {
                      setSelectedId(book.id);
                      setEditing(false);
                      setCreating(false);
                    }}
                  >
                    View {book.title}
                  </Button>
                </article>
              ))}
            </div>
          </>
        )
      )}
      {books && (
        <Pagination
          page={query.page}
          totalPages={books.pagination.totalPages}
          onPageChange={(page) => setQuery((v) => ({ ...v, page }))}
          busy={loading}
        />
      )}
      {selectedId && (
        <section
          ref={detailElement}
          className="catalog-stack"
          aria-label="Book details"
        >
          <div className="section-heading">
            <h2>Book details</h2>
            <Button
              onClick={() => {
                setSelectedId(null);
                setEditing(false);
              }}
            >
              Close details
            </Button>
          </div>
          <ErrorNotice error={detailError} />
          {Boolean(detailError) && (
            <Button onClick={changed}>Reload book</Button>
          )}
          {!detail && !detailError && (
            <Feedback kind="loading">Loading book details…</Feedback>
          )}
          {detail && (
            <>
              <article className="panel catalog-stack">
                <span className="badge">
                  {detail.book.archivedAt
                    ? "Archived"
                    : categoryName(detail.book.categoryId)}
                </span>
                <h3>{detail.book.title}</h3>
                <p>{detail.book.author}</p>
                <p className="book-description">
                  {detail.book.description || "No description available."}
                </p>
                <p>
                  {detail.book.isbn ? `ISBN ${detail.book.isbn}` : "No ISBN"}
                </p>
                {detail.available !== undefined && (
                  <Feedback kind={detail.available ? "success" : "empty"}>
                    {detail.available} copies available
                  </Feedback>
                )}
                {staff && (
                  <div className="catalog-actions">
                    <Button onClick={() => setEditing(true)}>Edit book</Button>
                    {!detail.book.archivedAt && (
                      <Button onClick={() => setConfirmArchive(true)}>
                        Archive book
                      </Button>
                    )}
                    <Button onClick={changed}>Reload book</Button>
                  </div>
                )}
                <ErrorNotice error={archive.error} />
                {confirmArchive && (
                  <div className="confirmation">
                    <p>
                      Archive “{detail.book.title}”? It will be hidden from the
                      public catalog. Open loans must be returned first.
                    </p>
                    <Button
                      busy={archive.busy}
                      onClick={() =>
                        void archive.submit(async () => {
                          await client.request(`/books/${detail.book.id}`, {
                            method: "DELETE",
                            headers: { "If-Match": detail.etag },
                          });
                          setConfirmArchive(false);
                          changed();
                        })
                      }
                    >
                      Confirm archive
                    </Button>
                    <Button
                      disabled={archive.busy}
                      onClick={() => setConfirmArchive(false)}
                    >
                      Keep book
                    </Button>
                  </div>
                )}
              </article>
              {editing && staff && (
                <BookForm
                  key={`${detail.book.id}-${detail.book.version}`}
                  book={detail.book}
                  categories={categories}
                  cancel={() => setEditing(false)}
                  save={async (body) => {
                    await client.request(`/books/${detail.book.id}`, {
                      method: "PUT",
                      headers: { "If-Match": detail.etag },
                      json: body,
                    });
                    setEditing(false);
                    changed();
                  }}
                />
              )}
              {staff && !detail.book.archivedAt && (
                <Copies
                  key={detail.book.id}
                  bookId={detail.book.id}
                  client={client}
                  revision={revision}
                  changed={changed}
                />
              )}
            </>
          )}
        </section>
      )}
      {staff && (
        <Categories categories={categories} client={client} changed={changed} />
      )}
    </div>
  );
}
