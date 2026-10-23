import { useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";

type CategoryInput = {
  name: string;
  slug: string;
};

export function CategoryForm({
  onCreate,
}: {
  onCreate: (input: CategoryInput) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  return (
    <form
      className="panel catalog"
      aria-label="Create category"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;

        const input = { name: name.trim(), slug: slug.trim() };
        setError("");
        setSuccess(false);

        if (!input.name) {
          setError("Category name is required.");
          return;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
          setError(
            "Use lowercase letters, numbers and single hyphens for the slug.",
          );
          return;
        }

        setBusy(true);
        try {
          await onCreate(input);
          setName("");
          setSlug("");
          setSuccess(true);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not create category.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Add category</h2>

      <div className="catalog-field">
        <label htmlFor="new-category-name">Category name</label>
        <input
          id="new-category-name"
          value={name}
          required
          maxLength={100}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="catalog-field">
        <label htmlFor="new-category-slug">Slug</label>
        <input
          id="new-category-slug"
          value={slug}
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="category-slug-help"
          disabled={busy}
          onChange={(event) => setSlug(event.target.value)}
        />
        <small id="category-slug-help">Example: science-fiction</small>
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}
      {success && (
        <Feedback kind="success">Category created successfully.</Feedback>
      )}

      <Button type="submit" busy={busy}>
        Create category
      </Button>
    </form>
  );
}
