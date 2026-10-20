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
  if (totalPages < 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button
        disabled={page <= 1 || busy}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        disabled={page >= totalPages || busy}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
