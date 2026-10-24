import { useTranslation } from "../../i18n/language";
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
  const { t, translate } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  return (
    <form
      className="panel catalog"
      aria-label={t("Create category")}
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
      <h2>{t("Add category")}</h2>

      <div className="catalog-field">
        <label htmlFor="new-category-name">{t("Category name")}</label>
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
        <label htmlFor="new-category-slug">{t("Slug")}</label>
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
        <small id="category-slug-help">{t("Example: science-fiction")}</small>
      </div>

      {error && <Feedback kind="error">{translate(error)}</Feedback>}
      {success && (
        <Feedback kind="success">
          {t("Category created successfully.")}
        </Feedback>
      )}

      <Button type="submit" busy={busy}>
        {t("Create category")}
      </Button>
    </form>
  );
}
