import { forbidden } from "../../shared/errors.js";
import { paginate } from "../../shared/pagination.js";
import type { createBooksRepository } from "./books.repository.js";
import type { ListBooksInput } from "./books.schema.js";

type BooksRepository = ReturnType<typeof createBooksRepository>;

export function createBooksService(repository: BooksRepository) {
  return {
    async list(input: ListBooksInput) {
      if (input.includeArchived === "true") {
        throw forbidden();
      }

      const total = await repository.count(input);
      const rows = await repository.list(input);

      return {
        data: rows.map((row) => ({
          id: row.id,
          categoryId: row.categoryId,
          isbn: row.isbn,
          title: row.title,
          author: row.author,
          description: row.description,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          version: row.version,
        })),
        pagination: paginate(input, total),
      };
    },
  };
}
