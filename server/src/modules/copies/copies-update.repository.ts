import type { PoolClient } from "pg";

export type CopyCondition = "AVAILABLE" | "MAINTENANCE" | "RETIRED";

type CopyRow = {
  id: string;
  bookId: string;
  barcode: string;
  conditionStatus: CopyCondition;
  createdAt: Date;
};

export async function lockCopy(client: PoolClient, id: string) {
  const result = await client.query<CopyRow>(
    `SELECT id, book_id AS "bookId", barcode,
            condition_status AS "conditionStatus",
            created_at AS "createdAt"
     FROM book_copies WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function hasOpenLoan(client: PoolClient, copyId: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM loans WHERE copy_id = $1 AND returned_at IS NULL
     ) AS exists`,
    [copyId],
  );
  return result.rows[0]!.exists;
}

export async function updateCopyCondition(
  client: PoolClient,
  id: string,
  condition: CopyCondition,
) {
  const result = await client.query<CopyRow>(
    `UPDATE book_copies SET condition_status = $2 WHERE id = $1
     RETURNING id, book_id AS "bookId", barcode,
       condition_status AS "conditionStatus",
       created_at AS "createdAt"`,
    [id, condition],
  );
  return result.rows[0]!;
}

export async function insertCopyUpdateAudit(
  client: PoolClient,
  actorId: string,
  copyId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "COPY_CONDITION_UPDATED", "book_copy", copyId, requestId],
  );
}
