import type { Pool, PoolClient } from "pg";
import type { Principal } from "../../middleware/context.js";
import { offsetOf } from "../../shared/pagination.js";
import type { Loan, LoanQuery, LoanReturn } from "./loans.schema.js";

type QueryClient = Pick<Pool | PoolClient, "query">;
type LoanRow = {
  id: string;
  user_id: string;
  book_id: string;
  copy_id: string;
  borrowed_at: Date;
  due_at: Date;
  returned_at: Date | null;
  returned_by: string | null;
};
const loanSelection = `SELECT l.id,l.user_id,c.book_id,l.copy_id,l.borrowed_at,l.due_at,l.returned_at,l.returned_by
  FROM loans l JOIN book_copies c ON c.id=l.copy_id`;

export const loanDto = (row: LoanRow): Loan => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  copyId: row.copy_id,
  borrowedAt: row.borrowed_at.toISOString(),
  dueAt: row.due_at.toISOString(),
  returnedAt: row.returned_at?.toISOString() ?? null,
  returnedBy: row.returned_by,
});
export const returnDto = (row: {
  id: string;
  returned_at: Date;
  returned_by: string;
}): LoanReturn => ({
  loanId: row.id,
  returnedAt: row.returned_at.toISOString(),
  returnedBy: row.returned_by,
});

export async function lockBorrower(client: PoolClient, id: string) {
  const result = await client.query<{
    id: string;
    role: string;
    status: string;
  }>("SELECT id,role,status FROM users WHERE id=$1 FOR UPDATE", [id]);
  return result.rows[0];
}
export async function activeBorrowing(
  client: PoolClient,
  userId: string,
  bookId: string,
) {
  const result = await client.query<{
    active_count: number;
    has_overdue: boolean;
    duplicate_book: boolean;
  }>(
    `SELECT count(*)::int AS active_count,
       coalesce(bool_or(l.due_at < now()),false) AS has_overdue,
       coalesce(bool_or(c.book_id=$2),false) AS duplicate_book
     FROM loans l JOIN book_copies c ON c.id=l.copy_id
     WHERE l.user_id=$1 AND l.returned_at IS NULL`,
    [userId, bookId],
  );
  return result.rows[0]!;
}
export async function lockBorrowableBook(client: PoolClient, bookId: string) {
  const result = await client.query<{ id: string; archived_at: Date | null }>(
    "SELECT id,archived_at FROM books WHERE id=$1 FOR UPDATE",
    [bookId],
  );
  return result.rows[0];
}
export async function lockAvailableCopy(client: PoolClient, bookId: string) {
  const result = await client.query<{ id: string }>(
    `SELECT c.id FROM book_copies c
     WHERE c.book_id=$1 AND c.condition_status='AVAILABLE'
       AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id=c.id AND l.returned_at IS NULL)
     ORDER BY c.id FOR UPDATE OF c LIMIT 1`,
    [bookId],
  );
  return result.rows[0];
}
export async function insertLoan(
  client: PoolClient,
  userId: string,
  copyId: string,
  days: number,
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO loans(user_id,copy_id,borrowed_at,due_at)
     VALUES($1,$2,now(),now()+($3::integer * interval '24 hours')) RETURNING id`,
    [userId, copyId, days],
  );
  return result.rows[0]!.id;
}
export async function insertLoanAudit(
  client: PoolClient,
  principal: Principal,
  action: string,
  id: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id)
     VALUES($1,$2,'loan',$3,$4)`,
    [principal.id, action, id, requestId],
  );
}
export async function findLoan(
  client: QueryClient,
  id: string,
  actor?: Principal,
) {
  const values: string[] = [id];
  const ownerFilter = actor?.role === "MEMBER" ? " AND l.user_id=$2" : "";
  if (actor?.role === "MEMBER") values.push(actor.id);
  const result = await client.query<LoanRow>(
    `${loanSelection} WHERE l.id=$1${ownerFilter}`,
    values,
  );
  return result.rows[0] ? loanDto(result.rows[0]) : null;
}
export async function listLoanRows(
  client: QueryClient,
  actor: Principal,
  input: LoanQuery,
) {
  const values: unknown[] = [];
  const filters: string[] = [];
  if (actor.role === "MEMBER") {
    values.push(actor.id);
    filters.push(`l.user_id=$${values.length}`);
  }
  if (input.status === "ACTIVE") filters.push("l.returned_at IS NULL");
  if (input.status === "RETURNED") filters.push("l.returned_at IS NOT NULL");
  if (input.status === "OVERDUE")
    filters.push("l.returned_at IS NULL AND l.due_at < now()");
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const count = await client.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM loans l${where}`,
    values,
  );
  values.push(input.limit, offsetOf(input));
  const rows = await client.query<LoanRow>(
    `${loanSelection}${where} ORDER BY l.borrowed_at DESC,l.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { data: rows.rows.map(loanDto), total: count.rows[0]!.total };
}
export async function findCopyForLoan(client: PoolClient, id: string) {
  return (
    await client.query<{ copy_id: string }>(
      "SELECT copy_id FROM loans WHERE id=$1",
      [id],
    )
  ).rows[0]?.copy_id;
}
export async function lockReturnRows(
  client: PoolClient,
  loanId: string,
  copyId: string,
) {
  await client.query("SELECT id FROM book_copies WHERE id=$1 FOR UPDATE", [
    copyId,
  ]);
  return (
    await client.query<{
      id: string;
      returned_at: Date | null;
      returned_by: string | null;
    }>(
      "SELECT id,returned_at,returned_by FROM loans WHERE id=$1 AND copy_id=$2 FOR UPDATE",
      [loanId, copyId],
    )
  ).rows[0];
}
export async function markReturned(
  client: PoolClient,
  loanId: string,
  actorId: string,
) {
  return (
    await client.query<{ id: string; returned_at: Date; returned_by: string }>(
      "UPDATE loans SET returned_at=clock_timestamp(),returned_by=$2 WHERE id=$1 RETURNING id,returned_at,returned_by",
      [loanId, actorId],
    )
  ).rows[0]!;
}
