import { BookDetails } from "./BookDetails";
import { useEffect, useState } from "react";
import { api } from "../../lib/http";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { BookForm } from "./BookForm";
import { loadAllCategories } from "./loadCategories";
import type { Book, BookInput, Category } from "./types";
import "./catalog.css";

type Collection<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Filters = {
  q: string;
  categoryId: string;
  sort: string;
  includeArchived: boolean;
};

const initialFilters: Filters = {
  q: "",
  categoryId: "",
  sort: "title",
  includeArchived: false,
};

export function CatalogPage({
  client = api,
  user,
  onNavigate,
}: {
  client?: Pick<typeof api, "request">;
  user?: { role: "MEMBER" | "LIBRARIAN" | "ADMIN" } | null;
  onNavigate?: (path: string) => void;
} = {}) {
  const staff = user?.role === "LIBRARIAN" || user?.role === "ADMIN";
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<Collection<Book> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: "2",
          sort: filters.sort,
        });
        if (filters.q) query.set("q", filters.q);
        if (filters.categoryId) query.set("categoryId", filters.categoryId);
        if (staff && filters.includeArchived)
          query.set("includeArchived", "true");

        const books = await client.request<Collection<Book>>(
          `/books?${query.toString()}`,
          { signal: controller.signal },
        );

        const allCategories = await loadAllCategories(
          client,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setResult(books);
          setCategories(allCategories);
          setError("");
          setLoading(false);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "Could not load catalog.",
        );
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [client, filters, page, attempt, staff]);

  function changePage(nextPage: number) {
    setLoading(true);
    setError("");
    setPage(nextPage);
  }

  async function createBook(input: BookInput) {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await client.request<{ data: Book }>("/books", {
        method: "POST",
        json: input,
      });
      setCreating(false);
      setLoading(true);
      setAttempt((value) => value + 1);
      onNavigate?.(`/books/${response.data.id}`);
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Could not create book.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="catalog" aria-label="Book catalog">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Library collection</p>
          <h1>Book catalog</h1>
          <p className="lead">
            Discover your next read and check live copy availability.
          </p>
        </div>
        {staff && (
          <div className="action-row">
            <Button
              onClick={() => {
                setCreating((value) => !value);
                setSaveError("");
              }}
            >
              Add book
            </Button>
            {onNavigate && (
              <Button onClick={() => onNavigate("/categories")}>
                Manage categories
              </Button>
            )}
          </div>
        )}
      </div>
      {staff && creating && (
        <section className="panel stack" aria-labelledby="create-book-title">
          <h2 id="create-book-title">Add a book</h2>
          {categories.length === 0 && (
            <Feedback kind="empty">
              Create a category before adding a book.
            </Feedback>
          )}
          {saveError && <Feedback kind="error">{saveError}</Feedback>}
          <BookForm
            categories={categories}
            busy={saving}
            submitLabel="Create book"
            onSubmit={createBook}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}
      <form
        className="catalog-filters panel"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setError("");
          setPage(1);
          setFilters({ ...draft, q: draft.q.trim() });
        }}
      >
        <div className="catalog-field">
          <label htmlFor="catalog-search">Title or author</label>
          <input
            id="catalog-search"
            type="search"
            maxLength={200}
            placeholder="Search books..."
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </div>

        <div className="catalog-field">
          <label htmlFor="catalog-category">Category</label>
          <select
            id="catalog-category"
            value={draft.categoryId}
            onChange={(event) =>
              setDraft({ ...draft, categoryId: event.target.value })
            }
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-field">
          <label htmlFor="catalog-sort">Sort by</label>
          <select
            id="catalog-sort"
            value={draft.sort}
            onChange={(event) =>
              setDraft({ ...draft, sort: event.target.value })
            }
          >
            <option value="title">Title A-Z</option>
            <option value="-title">Title Z-A</option>
            <option value="-createdAt">Newest first</option>
            <option value="createdAt">Oldest first</option>
          </select>
        </div>

        <Button type="submit" busy={loading}>
          Search
        </Button>
        {staff && (
          <label className="checkbox-field" htmlFor="catalog-archived">
            <input
              id="catalog-archived"
              type="checkbox"
              checked={draft.includeArchived}
              onChange={(event) =>
                setDraft({ ...draft, includeArchived: event.target.checked })
              }
            />
            Include archived
          </label>
        )}
      </form>

      {loading && <Feedback kind="loading">Loading books...</Feedback>}

      {!loading && error && (
        <div className="panel">
          <Feedback kind="error">{error}</Feedback>
          <Button
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && result && (
        <>
          <p aria-live="polite">{result.pagination.total} books found</p>

          {result.data.length === 0 ? (
            <p className="panel">
              No books found. Try another search or category.
            </p>
          ) : (
            <div className="catalog-grid">
              {result.data.map((book) => (
                <article key={book.id} className="panel catalog-card">
                  <span className="badge">
                    {categories.find((item) => item.id === book.categoryId)
                      ?.name ?? "Book"}
                  </span>
                  <h2>{book.title}</h2>
                  {book.archivedAt && <span className="badge">Archived</span>}
                  <p className="catalog-author">{book.author}</p>
                  <p>{book.description || "No description available."}</p>
                  <BookDetails
                    bookId={book.id}
                    title={book.title}
                    client={client}
                  />
                  {onNavigate && (
                    <Button
                      onClick={() => onNavigate(`/books/${book.id}`)}
                      aria-label={`View ${book.title}`}
                    >
                      Open book
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}

          <Pagination
            page={result.pagination.page}
            totalPages={result.pagination.totalPages}
            onPageChange={changePage}
          />
        </>
      )}
    </section>
  );
}
