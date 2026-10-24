import type { Pool } from "pg";
import { offsetOf } from "../../shared/pagination.js";
import type { AuditQuery } from "./administration.schema.js";

export async function readDashboard(pool: Pool) {
  const result = await pool.query<{
    active_books: number;
    serviceable_copies: number;
    active_loans: number;
    overdue_loans: number;
    as_of: Date;
  }>(`SELECT
    (SELECT count(*)::int FROM books WHERE archived_at IS NULL) AS active_books,
    (SELECT count(*)::int FROM book_copies WHERE condition_status <> 'RETIRED') AS serviceable_copies,
    (SELECT count(*)::int FROM loans WHERE returned_at IS NULL) AS active_loans,
    (SELECT count(*)::int FROM loans WHERE returned_at IS NULL AND due_at < statement_timestamp()) AS overdue_loans,
    statement_timestamp() AS as_of`);
  const row = result.rows[0]!;
  return {
    activeBooks: row.active_books,
    serviceableCopies: row.serviceable_copies,
    activeLoans: row.active_loans,
    overdueLoans: row.overdue_loans,
    asOf: row.as_of.toISOString(),
  };
}
export async function readAuditLogs(pool: Pool, input: AuditQuery) {
  const values: unknown[] = [];
  const filters: string[] = [];
  for (const [value, sql] of [
    [input.action, "action ="],
    [input.actorId, "actor_id ="],
    [input.from, "occurred_at >="],
    [input.to, "occurred_at <"],
  ] as const) {
    if (value !== undefined) {
      values.push(value);
      filters.push(`${sql} $${values.length}`);
    }
  }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const count = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM audit_logs${where}`,
    values,
  );
  values.push(input.limit, offsetOf(input));
  const result = await pool.query<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    request_id: string;
    occurred_at: Date;
  }>(
    `SELECT id,actor_id,action,entity_type,entity_id,request_id,occurred_at FROM audit_logs${where}
     ORDER BY occurred_at DESC,id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    total: count.rows[0]!.total,
    data: result.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      requestId: row.request_id,
      occurredAt: row.occurred_at.toISOString(),
    })),
  };
}
