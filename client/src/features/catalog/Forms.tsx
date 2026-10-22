import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { Feedback } from "../../components/Feedback";
import { useSubmission } from "./useSubmission";
import { ApiError } from "../../lib/http";
import type { Book, Category } from "./types";
export type BookDraft = Pick<
  Book,
  "categoryId" | "isbn" | "title" | "author" | "description"
>;
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Feedback kind="error">
      {error instanceof Error ? error.message : "The request failed."}
      {error instanceof ApiError && error.problem.requestId && (
        <small className="request-id">
          Request ID: {error.problem.requestId}
        </small>
      )}
    </Feedback>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  children,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}
export function BookForm({
  book,
  categories,
  save,
  cancel,
}: {
  book?: Book;
  categories: Category[];
  save: (body: BookDraft) => Promise<void>;
  cancel: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [categoryId, setCategoryId] = useState(book?.categoryId ?? "");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const task = useSubmission();
  function submit(e: FormEvent) {
    e.preventDefault();
    void task.submit(() =>
      save({
        title,
        author,
        categoryId,
        isbn: isbn.trim() || null,
        description,
      }),
    );
  }
  return (
    <form
      className="panel catalog-form"
      onSubmit={submit}
      aria-label={book ? "Edit book" : "Add book"}
    >
      <h2>{book ? "Edit book" : "Add book"}</h2>
      <ErrorNotice error={task.error} />
      <FormField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={255}
        error={task.fieldError("title")}
      />
      <FormField
        label="Author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        required
        maxLength={255}
        error={task.fieldError("author")}
      />
      <SelectField
        label="Book category"
        value={categoryId}
        onChange={setCategoryId}
        required
      >
        <option value="">Choose a category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <FormField
        label="ISBN (optional)"
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        pattern="([0-9]{9}[0-9X]|[0-9]{13})"
        hint="10 or 13 characters, without hyphens."
        error={task.fieldError("isbn")}
      />
      <label className="form-field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={4}
        />
      </label>
      <div className="catalog-actions">
        <Button type="submit" busy={task.busy}>
          {book ? "Save book" : "Create book"}
        </Button>
        <Button onClick={cancel} disabled={task.busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function CategoryForm({
  category,
  save,
  cancel,
}: {
  category?: Category;
  save: (body: { name: string; slug: string }) => Promise<void>;
  cancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const task = useSubmission();
  return (
    <form
      className="catalog-form"
      aria-label={category ? "Edit category" : "Add category"}
      onSubmit={(e) => {
        e.preventDefault();
        void task.submit(() => save({ name, slug }));
      }}
    >
      <h3>{category ? "Edit category" : "Add category"}</h3>
      <ErrorNotice error={task.error} />
      <FormField
        label="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={100}
        error={task.fieldError("name")}
      />
      <FormField
        label="Category slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        required
        maxLength={100}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        hint="Lowercase words separated by hyphens."
        error={task.fieldError("slug")}
      />
      <div className="catalog-actions">
        <Button type="submit" busy={task.busy}>
          Save category
        </Button>
        <Button onClick={cancel} disabled={task.busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
