import type { Pool, PoolClient } from "pg";
import type { Role } from "../../middleware/context.js";
import { offsetOf, type PaginationInput } from "../../shared/pagination.js";
import type { UserPatch } from "./users.schema.js";

export type UserRecord = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  created_at: Date;
};
export type SafeUser = ReturnType<typeof toUser>;
export const userColumns =
  "id, full_name, email, password_hash, role, status, created_at";
type Database = Pool | PoolClient;

export function toUser(row: UserRecord) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUser(db: Database, id: string) {
  return (
    (
      await db.query<UserRecord>(
        `SELECT ${userColumns} FROM users WHERE id = $1`,
        [id],
      )
    ).rows[0] ?? null
  );
}

export async function findUserByEmail(db: Database, email: string) {
  return (
    (
      await db.query<UserRecord>(
        `SELECT ${userColumns} FROM users WHERE email = $1`,
        [email],
      )
    ).rows[0] ?? null
  );
}

export async function lockUser(db: PoolClient, id: string) {
  return (
    (
      await db.query<UserRecord>(
        `SELECT ${userColumns} FROM users WHERE id = $1 FOR UPDATE`,
        [id],
      )
    ).rows[0] ?? null
  );
}

export async function insertAudit(
  db: PoolClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
) {
  await db.query(
    "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, request_id) VALUES ($1,$2,$3,$4,$5)",
    [actorId, action, entityType, entityId, requestId],
  );
}

export async function listUsers(pool: Pool, input: PaginationInput) {
  const rows = await pool.query<UserRecord>(
    `SELECT ${userColumns} FROM users ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`,
    [input.limit, offsetOf(input)],
  );
  const count = await pool.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM users",
  );
  return { rows: rows.rows, total: count.rows[0]!.total };
}

export async function lockAdministration(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(726194035)");
}

export async function lockUsers(client: PoolClient, ids: string[]) {
  return (
    await client.query<UserRecord>(
      `SELECT ${userColumns} FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [ids],
    )
  ).rows;
}

export async function countActiveAdmins(client: PoolClient) {
  return (
    await client.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM users WHERE role='ADMIN' AND status='ACTIVE'",
    )
  ).rows[0]!.total;
}

export async function updateUser(
  client: PoolClient,
  id: string,
  patch: Required<UserPatch>,
) {
  return (
    await client.query<UserRecord>(
      `UPDATE users SET role=$2,status=$3,updated_at=now() WHERE id=$1 RETURNING ${userColumns}`,
      [id, patch.role, patch.status],
    )
  ).rows[0]!;
}

export async function revokeUserSessions(client: PoolClient, userId: string) {
  await client.query(
    "UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
    [userId],
  );
}
