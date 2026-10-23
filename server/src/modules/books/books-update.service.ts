import { expectedVersion } from "./books-version.js";
import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import type { CreateBookInput } from "./books-write.schema.js";
import {
  updateBookMetadata,
  bookExists,
  lockMetadataCategory,
  insertMetadataAudit,
} from "./books-update.repository.js";

export async function changeBookMetadata(
  pool: Pool,
  actor: Principal,
  bookId: string,
  input: Partial<CreateBookInput>,
  ifMatch: string | undefined,
  requestId: string,
) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }

  const version = expectedVersion(bookId, ifMatch);

  try {
    return await withTransaction(pool, async (client) => {
      if (input.categoryId !== undefined) {
        if (!(await lockMetadataCategory(client, input.categoryId))) {
          throw new AppError(
            400,
            "INVALID_CATEGORY",
            "Bad Request",
            "The selected category does not exist.",
          );
        }
      }

      const book = await updateBookMetadata(client, bookId, version, input);

      if (!book) {
        if (!(await bookExists(client, bookId))) {
          throw new AppError(
            404,
            "RESOURCE_NOT_FOUND",
            "Not Found",
            "The requested book was not found.",
          );
        }

        throw new AppError(
          412,
          "VERSION_MISMATCH",
          "Precondition Failed",
          "The book has changed. Reload it before editing.",
        );
      }

      await insertMetadataAudit(client, actor.id, bookId, requestId);
      return {
        ...book,
        archivedAt: book.archivedAt?.toISOString() ?? null,
      };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(
        409,
        "ISBN_ALREADY_EXISTS",
        "Conflict",
        "A book with this ISBN already exists.",
      );
    }
    throw error;
  }
}
