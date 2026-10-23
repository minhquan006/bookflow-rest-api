import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import { paginate, type PaginationInput } from "../../shared/pagination.js";
import {
  createCopiesRepository,
  lockCopyBook,
  insertCopy,
  insertCopyAudit,
} from "./copies.repository.js";

function assertStaff(actor: Principal) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }
}

function missingBook() {
  return new AppError(
    404,
    "RESOURCE_NOT_FOUND",
    "Not Found",
    "The requested book was not found.",
  );
}

export function createCopiesService(pool: Pool) {
  const repository = createCopiesRepository(pool);

  return {
    async list(actor: Principal, bookId: string, input: PaginationInput) {
      assertStaff(actor);
      if (!(await repository.findBook(bookId))) throw missingBook();

      const total = await repository.count(bookId);
      const rows = await repository.list(bookId, input);

      return {
        data: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        pagination: paginate(input, total),
      };
    },

    async create(
      actor: Principal,
      bookId: string,
      barcode: string,
      requestId: string,
    ) {
      assertStaff(actor);

      try {
        return await withTransaction(pool, async (client) => {
          const book = await lockCopyBook(client, bookId);
          if (!book) throw missingBook();

          if (book.archivedAt !== null) {
            throw new AppError(
              409,
              "BOOK_ARCHIVED",
              "Conflict",
              "Cannot add a copy to an archived book.",
            );
          }

          const copy = await insertCopy(client, bookId, barcode);
          await insertCopyAudit(client, actor.id, copy.id, requestId);

          return {
            ...copy,
            createdAt: copy.createdAt.toISOString(),
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
            "BARCODE_ALREADY_EXISTS",
            "Conflict",
            "A copy with this barcode already exists.",
          );
        }
        throw error;
      }
    },
  };
}
