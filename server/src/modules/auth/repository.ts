import type { PoolClient } from "pg";
import type { Role } from "../../middleware/context.js";

type Client = Pick<PoolClient, "query">;
export type User = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  createdAt: Date;
};
export type Account = User & { passwordHash: string };
const columns = `id, full_name AS "fullName", email, role, status, created_at AS "createdAt"`;

export async function insertUser(
  client: Client,
  fullName: string,
  email: string,
  passwordHash: string,
) {
  const result = await client.query<User>(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE') RETURNING ${columns}`,
    [fullName, email, passwordHash],
  );
  return result.rows[0]!;
}

export async function findAccount(client: Client, email: string) {
  const result = await client.query<Account>(
    `SELECT ${columns}, password_hash AS "passwordHash" FROM users WHERE email = $1 FOR UPDATE`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUser(client: Client, id: string) {
  const result = await client.query<User>(
    `SELECT ${columns} FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertSession(
  client: Client,
  session: {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  },
) {
  await client.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [
      session.id,
      session.userId,
      session.tokenHash,
      session.familyId,
      session.expiresAt,
    ],
  );
}

export async function insertAudit(
  client: Client,
  userId: string,
  action: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, request_id) VALUES ($1, $2, 'user', $1, $3)`,
    [userId, action, requestId],
  );
}
