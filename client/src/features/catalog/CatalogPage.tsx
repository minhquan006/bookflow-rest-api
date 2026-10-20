import { BookDetails } from "./BookDetails";
import { useEffect, useState } from "react";
import { api } from "../../lib/http";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import "./catalog.css";

type Category = {
  id: string;
  name: string;
};

type Book = {
  id: string;
  categoryId: string;
  title: string;
  author: string;
  description: string;
};

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
};

const initialFilters: Filters = {
  q: "",
  categoryId: "",
  sort: "title",
};

export function CatalogPage() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<Collection<Book> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const books = await api.request<Collection<Book>>(
          `/books?${query.toString()}`,
          { signal: controller.signal },
        );

        const allCategories: Category[] = [];
        let categoryPage = 1;
        let totalPages = 1;

        do {
          const response = await api.request<Collection<Category>>(
            `/categories?page=${categoryPage}&limit=100`,
            { signal: controller.signal },
          );
          allCategories.push(...response.data);
          totalPages = response.pagination.totalPages;
          categoryPage += 1;
        } while (categoryPage <= totalPages);

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
  }, [filters, page, attempt]);

  function changePage(nextPage: number) {
    setLoading(true);
    setError("");
    setPage(nextPage);
  }

  return (
    <section className="catalog" aria-label="Book catalog">
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
                  <p className="catalog-author">{book.author}</p>
                  <p>{book.description || "No description available."}</p>
                  <BookDetails bookId={book.id} title={book.title} />
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
