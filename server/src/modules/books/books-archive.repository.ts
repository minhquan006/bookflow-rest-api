import type { PoolClient } from "pg";

export async function lockArchiveBook(client: PoolClient, id: string) {
  const result = await client.query<{
    id: string;
    version: number;
    archivedAt: Date | null;
  }>(
    `SELECT id, version, archived_at AS "archivedAt"
     FROM books WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function bookHasOpenLoans(client: PoolClient, bookId: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM loans l
       JOIN book_copies c ON c.id = l.copy_id
       WHERE c.book_id = $1 AND l.returned_at IS NULL
     ) AS exists`,
    [bookId],
  );
  return result.rows[0]!.exists;
}

export async function markBookArchived(
  client: PoolClient,
  id: string,
  version: number,
) {
  const result = await client.query<{ version: number }>(
    `UPDATE books
     SET archived_at = now(), version = version + 1, updated_at = now()
     WHERE id = $1 AND version = $2
     RETURNING version`,
    [id, version],
  );
  return result.rows[0] ?? null;
}

export async function insertArchiveAudit(
  client: PoolClient,
  actorId: string,
  bookId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "BOOK_ARCHIVED", "book", bookId, requestId],
  );
}
