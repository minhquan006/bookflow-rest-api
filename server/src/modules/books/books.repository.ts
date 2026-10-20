import type { Pool } from "pg";
import { offsetOf } from "../../shared/pagination.js";
import type { ListBooksInput } from "./books.schema.js";

type BookRow = {
  id: string;
  categoryId: string;
  isbn: string | null;
  title: string;
  author: string;
  description: string;
  archivedAt: Date | null;
  version: number;
};

const sortColumns = {
  title: "title ASC",
  "-title": "title DESC",
  createdAt: "created_at ASC",
  "-createdAt": "created_at DESC",
} as const;

const filters = `
  archived_at IS NULL
  AND (
    $1::text IS NULL
    OR title ILIKE $1
    OR author ILIKE $1
  )
  AND ($2::uuid IS NULL OR category_id = $2::uuid)
`;

function filterValues(input: ListBooksInput) {
  const keyword = input.q ? `%${input.q.replace(/[\\%_]/g, "\\$&")}%` : null;

  return [keyword, input.categoryId ?? null];
}

export function createBooksRepository(pool: Pool) {
  return {
    async list(input: ListBooksInput) {
      const result = await pool.query<BookRow>(
        `SELECT
           id,
           category_id AS "categoryId",
           isbn,
           title,
           author,
           description,
           archived_at AS "archivedAt",
           version
         FROM books
         WHERE ${filters}
         ORDER BY ${sortColumns[input.sort]}, id ASC
         LIMIT $3 OFFSET $4`,
        [...filterValues(input), input.limit, offsetOf(input)],
      );

      return result.rows;
    },

    async count(input: ListBooksInput) {
      const result = await pool.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM books WHERE ${filters}`,
        filterValues(input),
      );

      return Number(result.rows[0]!.total);
    },
  };
}
