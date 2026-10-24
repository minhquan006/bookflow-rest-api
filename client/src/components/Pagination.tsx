import { useTranslation } from "../i18n/language";
import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  onPageChange,
  busy = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  if (totalPages < 1) return null;
  return (
    <nav className="pagination" aria-label={t("Pagination")}>
      <Button
        disabled={page <= 1 || busy}
        onClick={() => onPageChange(page - 1)}
      >
        {t("Previous")}
      </Button>
      <span aria-live="polite">
        {t("Page {page} of {totalPages}", { page, totalPages })}
      </span>
      <Button
        disabled={page >= totalPages || busy}
        onClick={() => onPageChange(page + 1)}
      >
        {t("Next")}
      </Button>
    </nav>
  );
}
