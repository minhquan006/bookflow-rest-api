import { useSubmission } from "./useSubmission";
import { useRemote } from "./useRemote";
import { useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { Feedback } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { type createApiClient } from "../../lib/http";
import { CategoryForm, ErrorNotice } from "./Forms";
import type { Category, Copy, Page } from "./types";
export type Client = ReturnType<typeof createApiClient>;
export function Categories({
  categories,
  client,
  changed,
}: {
  categories: Category[];
  client: Client;
  changed: () => void;
}) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const task = useSubmission();
  const [page, setPage] = useState(1);
  const pages = Math.ceil(categories.length / 10);
  const currentPage = Math.min(page, Math.max(1, pages));
  return (
    <section className="panel catalog-stack" aria-label="Manage categories">
      <div className="section-heading">
        <h2>Categories</h2>
        <Button onClick={() => setEditing("new")}>Add category</Button>
      </div>
      <ErrorNotice error={task.error} />
      {editing && (
        <CategoryForm
          key={typeof editing === "string" ? editing : editing.id}
          category={typeof editing === "string" ? undefined : editing}
          cancel={() => setEditing(null)}
          save={async (body) => {
            await client.request(
              typeof editing === "string"
                ? "/categories"
                : `/categories/${editing.id}`,
              {
                method: typeof editing === "string" ? "POST" : "PUT",
                json: body,
              },
            );
            setEditing(null);
            changed();
          }}
        />
      )}
      {categories.length === 0 && (
        <Feedback kind="empty">
          No categories yet. Add one before creating a book.
        </Feedback>
      )}
      {categories.slice((currentPage - 1) * 10, currentPage * 10).map((c) => (
        <div className="catalog-row" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            <small>{c.slug}</small>
          </div>
          <div className="catalog-actions">
            <Button onClick={() => setEditing(c)}>Edit {c.name}</Button>
            <Button onClick={() => setRemoving(c)}>Delete {c.name}</Button>
          </div>
        </div>
      ))}
      <Pagination
        page={currentPage}
        totalPages={pages}
        onPageChange={setPage}
      />
      {removing && (
        <div
          className="confirmation"
          role="group"
          aria-label="Confirm category deletion"
        >
          <p>
            Delete “{removing.name}”? Categories referenced by any book cannot
            be deleted.
          </p>
          <Button
            busy={task.busy}
            onClick={() =>
              void task.submit(async () => {
                await client.request(`/categories/${removing.id}`, {
                  method: "DELETE",
                });
                setRemoving(null);
                changed();
              })
            }
          >
            Confirm delete
          </Button>
          <Button disabled={task.busy} onClick={() => setRemoving(null)}>
            Keep category
          </Button>
        </div>
      )}
    </section>
  );
}
export function Copies({
  bookId,
  client,
  revision,
  changed,
}: {
  bookId: string;
  client: Client;
  revision: number;
  changed: () => void;
}) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [barcode, setBarcode] = useState("");
  const task = useSubmission();
  const loader = useCallback(
    (signal: AbortSignal) => {
      void revision;
      void attempt;
      return client.request<Page<Copy>>(
        `/books/${bookId}/copies?page=${page}&limit=10`,
        { signal },
      );
    },
    [bookId, client, page, revision, attempt],
  );
  const { data: result, error, loading } = useRemote(loader);
  return (
    <section className="panel catalog-stack" aria-label="Physical copies">
      <h2>Physical copies</h2>
      <ErrorNotice error={task.error ?? error} />
      {Boolean(error) && (
        <Button onClick={() => setAttempt((v) => v + 1)}>Retry copies</Button>
      )}
      <form
        className="catalog-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void task.submit(async () => {
            await client.request(`/books/${bookId}/copies`, {
              method: "POST",
              json: { barcode },
            });
            setBarcode("");
            changed();
          });
        }}
      >
        <FormField
          label="New copy barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          required
          maxLength={64}
          error={task.fieldError("barcode")}
        />
        <Button type="submit" busy={task.busy}>
          Add copy
        </Button>
      </form>
      {loading ? (
        <Feedback kind="loading">Loading copies…</Feedback>
      ) : !error && result?.data.length === 0 ? (
        <Feedback kind="empty">No physical copies yet.</Feedback>
      ) : (
        !error &&
        result?.data.map((copy) => (
          <div className="catalog-row" key={copy.id}>
            <strong>{copy.barcode}</strong>
            <label className="form-field">
              <span>Condition for {copy.barcode}</span>
              <select
                value={copy.conditionStatus}
                disabled={task.busy}
                onChange={(e) => {
                  const conditionStatus = e.target.value;
                  void task.submit(async () => {
                    await client.request(`/copies/${copy.id}`, {
                      method: "PATCH",
                      json: { conditionStatus },
                    });
                    changed();
                  });
                }}
              >
                {["AVAILABLE", "MAINTENANCE", "RETIRED"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        ))
      )}
      {result && (
        <Pagination
          page={page}
          totalPages={result.pagination.totalPages}
          onPageChange={setPage}
          busy={loading}
        />
      )}
    </section>
  );
}
