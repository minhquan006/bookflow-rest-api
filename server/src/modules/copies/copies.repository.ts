import type { Pool, PoolClient } from "pg";
import { offsetOf, type PaginationInput } from "../../shared/pagination.js";

type CopyRow = {
  id: string;
  bookId: string;
  barcode: string;
  conditionStatus: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
  createdAt: Date;
};

export function createCopiesRepository(pool: Pool) {
  return {
    async findBook(id: string) {
      const result = await pool.query("SELECT id FROM books WHERE id = $1", [
        id,
      ]);
      return result.rowCount !== 0;
    },

    async list(bookId: string, input: PaginationInput) {
      const result = await pool.query<CopyRow>(
        `SELECT id, book_id AS "bookId", barcode,
                condition_status AS "conditionStatus",
                created_at AS "createdAt"
         FROM book_copies WHERE book_id = $1
         ORDER BY created_at ASC, id ASC
         LIMIT $2 OFFSET $3`,
        [bookId, input.limit, offsetOf(input)],
      );
      return result.rows;
    },

    async count(bookId: string) {
      const result = await pool.query<{ total: string }>(
        "SELECT COUNT(*) AS total FROM book_copies WHERE book_id = $1",
        [bookId],
      );
      return Number(result.rows[0]!.total);
    },
  };
}

export async function lockCopyBook(client: PoolClient, bookId: string) {
  const result = await client.query<{
    id: string;
    archivedAt: Date | null;
  }>(
    `SELECT id, archived_at AS "archivedAt"
     FROM books WHERE id = $1 FOR UPDATE`,
    [bookId],
  );
  return result.rows[0] ?? null;
}

export async function insertCopy(
  client: PoolClient,
  bookId: string,
  barcode: string,
) {
  const result = await client.query<CopyRow>(
    `INSERT INTO book_copies (book_id, barcode)
     VALUES ($1, $2)
     RETURNING id, book_id AS "bookId", barcode,
       condition_status AS "conditionStatus",
       created_at AS "createdAt"`,
    [bookId, barcode],
  );
  return result.rows[0]!;
}

export async function insertCopyAudit(
  client: PoolClient,
  actorId: string,
  copyId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "COPY_CREATED", "book_copy", copyId, requestId],
  );
}
