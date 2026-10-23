import type { Pool } from "pg";

export type BookDetailRow = {
  id: string;
  categoryId: string;
  isbn: string | null;
  title: string;
  author: string;
  description: string;
  archivedAt: Date | null;
  version: number;
};

export function createBookDetailsRepository(pool: Pool) {
  return {
    async findById(id: string) {
      const result = await pool.query<BookDetailRow>(
        `SELECT id, category_id AS "categoryId", isbn, title,
                author, description, archived_at AS "archivedAt", version
         FROM books WHERE id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async availability(id: string) {
      const result = await pool.query<{
        id: string;
        archivedAt: Date | null;
        availableCopies: number;
      }>(
        `SELECT b.id, b.archived_at AS "archivedAt",
          (
            SELECT COUNT(*)::integer
            FROM book_copies c
            WHERE c.book_id = b.id
              AND c.condition_status = 'AVAILABLE'
              AND NOT EXISTS (
                SELECT 1 FROM loans l
                WHERE l.copy_id = c.id AND l.returned_at IS NULL
              )
          ) AS "availableCopies"
         FROM books b WHERE b.id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },
  };
}
