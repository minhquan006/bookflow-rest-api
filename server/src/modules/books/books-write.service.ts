import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import type { CreateBookInput } from "./books-write.schema.js";
import { insertBook, insertBookAudit } from "./books-write.repository.js";

export async function createBook(
  pool: Pool,
  actor: Principal,
  input: CreateBookInput,
  requestId: string,
) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }

  try {
    return await withTransaction(pool, async (client) => {
      const category = await client.query(
        "SELECT id FROM categories WHERE id = $1 FOR KEY SHARE",
        [input.categoryId],
      );

      if (category.rowCount === 0) {
        throw new AppError(
          400,
          "INVALID_CATEGORY",
          "Bad Request",
          "The selected category does not exist.",
        );
      }

      const book = await insertBook(client, input);
      await insertBookAudit(client, actor.id, book.id, requestId);

      return {
        id: book.id,
        categoryId: book.categoryId,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        description: book.description,
        archivedAt: book.archivedAt?.toISOString() ?? null,
        version: book.version,
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
