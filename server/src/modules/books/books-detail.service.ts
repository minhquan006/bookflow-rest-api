import type { Principal } from "../../middleware/context.js";
import { AppError } from "../../shared/errors.js";
import type { createBookDetailsRepository } from "./books-detail.repository.js";

type Repository = ReturnType<typeof createBookDetailsRepository>;

function assertVisible(
  book: { archivedAt: Date | null } | null,
  actor?: Principal,
): asserts book is { archivedAt: Date | null } {
  const staff = actor?.role === "LIBRARIAN" || actor?.role === "ADMIN";

  if (!book || (book.archivedAt !== null && !staff)) {
    throw new AppError(
      404,
      "RESOURCE_NOT_FOUND",
      "Not Found",
      "The requested book was not found.",
    );
  }
}

export function createBookDetailsService(repository: Repository) {
  return {
    async detail(id: string, actor?: Principal) {
      const book = await repository.findById(id);
      assertVisible(book, actor);

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
    },

    async availability(id: string, actor?: Principal) {
      const book = await repository.availability(id);
      assertVisible(book, actor);

      return {
        bookId: book.id,
        availableCopies: book.availableCopies,
      };
    },
  };
}
