import { useEffect, useState } from "react";
import { api } from "../../lib/http";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";

type BookDetail = {
  id: string;
  title: string;
  author: string;
  description: string;
  isbn: string | null;
};

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; book: BookDetail; availableCopies: number };

function BookDetailContent({ bookId }: { bookId: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [book, availability] = await Promise.all([
          api.request<{ data: BookDetail }>(`/books/${bookId}`, {
            signal: controller.signal,
          }),
          api.request<{
            data: { bookId: string; availableCopies: number };
          }>(`/books/${bookId}/availability`, {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);

        if (!controller.signal.aborted) {
          setState({
            status: "ready",
            book: book.data,
            availableCopies: availability.data.availableCopies,
          });
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "Could not load book details.",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [bookId, attempt]);

  function reload() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  if (state.status === "loading") {
    return <Feedback kind="loading">Loading book details...</Feedback>;
  }

  if (state.status === "error") {
    return (
      <div>
        <Feedback kind="error">{state.message}</Feedback>
        <Button onClick={reload}>Retry details</Button>
      </div>
    );
  }

  return (
    <div>
      <dl>
        <dt>ISBN</dt>
        <dd>{state.book.isbn ?? "Not provided"}</dd>
        <dt>Description</dt>
        <dd>{state.book.description || "No description available."}</dd>
        <dt>Available copies</dt>
        <dd aria-live="polite">{state.availableCopies}</dd>
      </dl>
      {state.availableCopies === 0 && (
        <p>No copies are currently available for borrowing.</p>
      )}
      <Button onClick={reload}>Refresh availability</Button>
    </div>
  );
}

export function BookDetails({
  bookId,
  title,
}: {
  bookId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = `book-details-${bookId}`;

  return (
    <div>
      <Button
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${open ? "Hide" : "View"} details for ${title}`}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide details" : "View details"}
      </Button>
      <div id={contentId} hidden={!open}>
        {open && <BookDetailContent bookId={bookId} />}
      </div>
    </div>
  );
}
