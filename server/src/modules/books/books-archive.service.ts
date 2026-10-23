import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import { expectedVersion } from "./books-version.js";
import {
  lockArchiveBook,
  bookHasOpenLoans,
  markBookArchived,
  insertArchiveAudit,
} from "./books-archive.repository.js";

export async function archiveBook(
  pool: Pool,
  actor: Principal,
  bookId: string,
  ifMatch: string | undefined,
  requestId: string,
) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }

  const version = expectedVersion(bookId, ifMatch);

  return withTransaction(pool, async (client) => {
    const book = await lockArchiveBook(client, bookId);

    if (!book) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        "Not Found",
        "The requested book was not found.",
      );
    }

    if (book.version !== version) {
      throw new AppError(
        412,
        "VERSION_MISMATCH",
        "Precondition Failed",
        "The book has changed. Reload it before archiving.",
      );
    }

    if (book.archivedAt !== null) return book.version;

    if (await bookHasOpenLoans(client, bookId)) {
      throw new AppError(
        409,
        "BOOK_HAS_ACTIVE_LOANS",
        "Conflict",
        "Cannot archive a book with active loans.",
      );
    }

    const updated = await markBookArchived(client, bookId, version);
    if (!updated) {
      throw new AppError(
        412,
        "VERSION_MISMATCH",
        "Precondition Failed",
        "The book has changed. Reload it before archiving.",
      );
    }

    await insertArchiveAudit(client, actor.id, bookId, requestId);
    return updated.version;
  });
}
