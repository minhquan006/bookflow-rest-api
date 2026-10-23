import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Pagination } from "../../components/Pagination";
import { CategoryForm } from "./CategoryForm";
import { errorMessage } from "./types";
import type { Category, PaginationInfo } from "./types";

export function CategoriesPage() {
  const { user, api } = useAuth();
  const staff = user?.role === "LIBRARIAN" || user?.role === "ADMIN";
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .request<{ data: Category[]; pagination: PaginationInfo }>(
        `/categories?page=${page}&limit=20`,
        {
          signal: controller.signal,
        },
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          if (page > Math.max(1, result.pagination.totalPages)) {
            setPage(Math.max(1, result.pagination.totalPages));
            return;
          }
          setCategories(result.data);
          setPagination(result.pagination);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, page, refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      setError(
        "Enter a name and a lowercase kebab-case slug, such as science-fiction.",
      );
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request(`/categories/${editing.id}`, {
        method: "PUT",
        json: { name: name.trim(), slug: slug.trim() },
      });
      setMessage("Category updated.");
      setName("");
      setSlug("");
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function create(input: { name: string; slug: string }) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request("/categories", { method: "POST", json: input });
      setRefresh((value) => value + 1);
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.request(`/categories/${id}`, { method: "DELETE" });
      setMessage("Category deleted.");
      setConfirmDelete(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  if (!staff)
    return (
      <Feedback kind="error">
        Catalog management is available to librarians and administrators.
      </Feedback>
    );
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Catalog management</p>
        <h1>Categories</h1>
        <p className="lead">
          Organize books with clear, unique names and slugs.
        </p>
      </div>
      {error && <Feedback kind="error">{error}</Feedback>}
      {message && <Feedback kind="success">{message}</Feedback>}
      {editing ? (
        <section className="panel stack" aria-labelledby="category-form-title">
          <h2 id="category-form-title">Edit category</h2>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="stack"
          >
            <div className="form-grid">
              <FormField
                label="Category name"
                value={name}
                required
                maxLength={100}
                disabled={saving}
                onChange={(event) => setName(event.target.value)}
              />
              <FormField
                label="Category slug"
                value={slug}
                required
                maxLength={100}
                hint="Lowercase words separated by hyphens."
                disabled={saving}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="action-row">
              <Button type="submit" busy={saving}>
                Save category
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setName("");
                  setSlug("");
                }}
              >
                Cancel editing
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <CategoryForm onCreate={create} />
      )}
      <section className="panel stack" aria-labelledby="category-list-title">
        <h2 id="category-list-title">All categories</h2>
        {loading ? (
          <Feedback kind="loading">Loading categories…</Feedback>
        ) : categories.length === 0 ? (
          <Feedback kind="empty">
            No categories yet. Add one to start building the catalog.
          </Feedback>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.slug}</td>
                    <td>
                      <div className="action-row">
                        <Button
                          disabled={saving}
                          onClick={() => {
                            setEditing(category);
                            setName(category.name);
                            setSlug(category.slug);
                            setError("");
                          }}
                        >
                          Edit {category.name}
                        </Button>
                        <Button
                          disabled={saving}
                          onClick={() => setConfirmDelete(category.id)}
                        >
                          Delete {category.name}
                        </Button>
                      </div>
                      {confirmDelete === category.id && (
                        <div
                          role="group"
                          aria-label={`Confirm deleting ${category.name}`}
                        >
                          <p>
                            Delete this category? Categories referenced by books
                            cannot be deleted.
                          </p>
                          <div className="action-row">
                            <Button
                              busy={saving}
                              onClick={() => {
                                void remove(category.id);
                              }}
                            >
                              Confirm delete
                            </Button>
                            <Button
                              disabled={saving}
                              onClick={() => setConfirmDelete(null)}
                            >
                              Keep category
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          busy={loading || saving}
          onPageChange={(next) => {
            setConfirmDelete(null);
            setPage(next);
          }}
        />
        <p className="muted">{pagination.total} categories</p>
      </section>
    </div>
  );
}
