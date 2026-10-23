import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import type { BookInput, Category } from "./types";

export function BookForm({
  initial,
  categories,
  busy,
  blocked = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: BookInput;
  categories: Category[];
  busy: boolean;
  blocked?: boolean;
  submitLabel: string;
  onSubmit: (input: BookInput) => Promise<void>;
  onCancel: () => void;
}) {
  const categoryId = useId();
  const descriptionId = useId();
  const [values, setValues] = useState<BookInput>(() => ({
    title: initial?.title ?? "",
    author: initial?.author ?? "",
    isbn: initial?.isbn ?? null,
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    description: initial?.description ?? "",
  }));
  const [validation, setValidation] = useState("");
  function update<K extends keyof BookInput>(key: K, value: BookInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim() || !values.author.trim() || !values.categoryId) {
      setValidation("Title, author and category are required.");
      return;
    }
    if (
      values.isbn &&
      !/^(?:[0-9]{9}[0-9X]|[0-9]{13})$/.test(values.isbn.trim())
    ) {
      setValidation(
        "Enter an ISBN-10 or ISBN-13 without hyphens, or leave it empty.",
      );
      return;
    }
    setValidation("");
    await onSubmit({
      categoryId: values.categoryId,
      description: values.description,
      title: values.title.trim(),
      author: values.author.trim(),
      isbn: values.isbn?.trim() || null,
    });
  }
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="stack"
      aria-label={initial ? "Edit book metadata" : "Create book"}
    >
      <div className="form-grid">
        <FormField
          label="Title"
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
          required
          maxLength={255}
          disabled={busy}
        />
        <FormField
          label="Author"
          value={values.author}
          onChange={(event) => update("author", event.target.value)}
          required
          maxLength={255}
          disabled={busy}
        />
        <FormField
          label="ISBN"
          value={values.isbn ?? ""}
          onChange={(event) => update("isbn", event.target.value || null)}
          maxLength={13}
          hint="ISBN-10 or ISBN-13, without hyphens. Optional."
          disabled={busy}
        />
        <div className="form-field">
          <label htmlFor={categoryId}>Category</label>
          <select
            id={categoryId}
            value={values.categoryId}
            onChange={(event) => update("categoryId", event.target.value)}
            required
            disabled={busy}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor={descriptionId}>Description</label>
        <textarea
          id={descriptionId}
          value={values.description}
          maxLength={5000}
          rows={5}
          onChange={(event) => update("description", event.target.value)}
          disabled={busy}
        />
      </div>
      {validation && (
        <p role="alert" className="field-error">
          {validation}
        </p>
      )}
      <div className="action-row">
        <Button
          type="submit"
          busy={busy}
          disabled={blocked || categories.length === 0}
        >
          {submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
