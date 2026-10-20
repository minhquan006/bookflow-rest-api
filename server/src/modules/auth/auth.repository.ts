import type { Pool, PoolClient } from "pg";
import { userColumns, type UserRecord } from "../users/users.repository.js";
import type { RegisterInput } from "./auth.schema.js";

export type RefreshRecord = {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
};
export async function insertUser(
  client: PoolClient,
  input: RegisterInput,
  passwordHash: string,
) {
  return (
    await client.query<UserRecord>(
      `INSERT INTO users (full_name,email,password_hash) VALUES ($1,$2,$3) RETURNING ${userColumns}`,
      [input.fullName, input.email, passwordHash],
    )
  ).rows[0]!;
}
export async function findRefresh(pool: Pool, hash: string) {
  return (
    (
      await pool.query<RefreshRecord>(
        "SELECT id,user_id,family_id,expires_at,revoked_at FROM refresh_tokens WHERE token_hash=$1",
        [hash],
      )
    ).rows[0] ?? null
  );
}
export async function lockRefresh(client: PoolClient, id: string) {
  return (
    (
      await client.query<RefreshRecord>(
        "SELECT id,user_id,family_id,expires_at,revoked_at FROM refresh_tokens WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0] ?? null
  );
}
export async function insertRefresh(
  client: PoolClient,
  token: {
    id: string;
    userId: string;
    familyId: string;
    hash: string;
    expiresAt: Date;
  },
) {
  await client.query(
    "INSERT INTO refresh_tokens (id,user_id,family_id,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5)",
    [token.id, token.userId, token.familyId, token.hash, token.expiresAt],
  );
}
export async function revokeFamily(client: PoolClient, familyId: string) {
  return (
    (
      await client.query(
        "UPDATE refresh_tokens SET revoked_at=now() WHERE family_id=$1 AND revoked_at IS NULL",
        [familyId],
      )
    ).rowCount ?? 0
  );
}

export async function replaceRefresh(
  client: PoolClient,
  previousId: string,
  replacementId: string,
) {
  await client.query(
    "UPDATE refresh_tokens SET revoked_at=now(),replaced_by=$2 WHERE id=$1",
    [previousId, replacementId],
  );
}
