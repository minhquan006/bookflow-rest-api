import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { withTransaction } from "../../db/pool.js";
import { AppError, unauthenticated } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/passwords.js";
import { createAccessTokens } from "../../shared/tokens.js";
import {
  findUserByEmail,
  insertAudit,
  lockUser,
  toUser,
  type UserRecord,
} from "../users/users.repository.js";
import { createCsrfToken, verifyCsrfToken } from "./auth.cookies.js";
import {
  findRefresh,
  insertRefresh,
  insertUser,
  lockRefresh,
  revokeFamily,
  replaceRefresh,
} from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const invalidCredentials = () =>
  new AppError(
    401,
    "UNAUTHENTICATED",
    "Unauthorized",
    "The email or password is incorrect.",
  );
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function createAuthService(pool: Pool, config: AppConfig) {
  const tokens = createAccessTokens(config);
  // A single dummy hash keeps unknown-user verification on the same Argon2id path.
  const dummyPasswordHash = hashPassword(randomBytes(32).toString("base64url"));
  function newRefresh(userId: string, familyId: string = randomUUID()) {
    const rawToken = randomBytes(48).toString("base64url");
    return {
      id: randomUUID(),
      userId,
      familyId,
      rawToken,
      hash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 86_400_000),
    };
  }
  async function session(
    user: UserRecord,
    refresh: ReturnType<typeof newRefresh>,
  ) {
    const csrfToken = createCsrfToken(config, refresh.id);
    return {
      rawToken: refresh.rawToken,
      data: {
        accessToken: await tokens.sign(user.id),
        tokenType: "Bearer" as const,
        expiresIn: config.accessTokenTtlSeconds,
        csrfToken,
        user: toUser(user),
      },
    };
  }
  return {
    async register(input: RegisterInput, requestId: string) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await withTransaction(pool, async (client) => {
          const user = await insertUser(client, input, passwordHash);
          await insertAudit(
            client,
            user.id,
            "auth.registered",
            "user",
            user.id,
            requestId,
          );
          return toUser(user);
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505"
        ) {
          throw new AppError(
            409,
            "EMAIL_IN_USE",
            "Conflict",
            "This email is already registered.",
          );
        }
        throw error;
      }
    },
    async login(input: LoginInput, requestId: string) {
      const existing = await findUserByEmail(pool, input.email);
      const verified = await verifyPassword(
        existing?.password_hash ?? (await dummyPasswordHash),
        input.password,
      );
      if (!existing || !verified || existing.status !== "ACTIVE")
        throw invalidCredentials();
      return withTransaction(pool, async (client) => {
        const user = await lockUser(client, existing.id);
        if (
          !user ||
          user.status !== "ACTIVE" ||
          user.password_hash !== existing.password_hash
        )
          throw invalidCredentials();
        const refresh = newRefresh(user.id);
        await insertRefresh(client, refresh);
        await insertAudit(
          client,
          user.id,
          "auth.logged_in",
          "session",
          refresh.familyId,
          requestId,
        );
        return session(user, refresh);
      });
    },
    async refresh(
      rawToken: string | undefined,
      csrfToken: string,
      requestId: string,
    ) {
      if (!rawToken || !/^[A-Za-z0-9_-]{64}$/.test(rawToken))
        throw unauthenticated();
      const existing = await findRefresh(pool, hashToken(rawToken));
      if (!existing) throw unauthenticated();
      if (!verifyCsrfToken(config, csrfToken, existing.id))
        throw new AppError(
          403,
          "CSRF_REJECTED",
          "Forbidden",
          "The session request could not be verified.",
        );
      const result = await withTransaction(pool, async (client) => {
        // All session mutations lock user before token, including admin invalidation.
        const user = await lockUser(client, existing.user_id);
        const current = await lockRefresh(client, existing.id);
        if (!current || !user) return null;
        if (current.revoked_at) {
          await revokeFamily(client, current.family_id);
          await insertAudit(
            client,
            user.id,
            "auth.refresh_reuse",
            "session",
            current.family_id,
            requestId,
          );
          return null;
        }
        if (
          user.status !== "ACTIVE" ||
          current.expires_at.getTime() <= Date.now()
        ) {
          await revokeFamily(client, current.family_id);
          return null;
        }
        const replacement = newRefresh(user.id, current.family_id);
        await insertRefresh(client, replacement);
        await replaceRefresh(client, current.id, replacement.id);
        await insertAudit(
          client,
          user.id,
          "auth.refreshed",
          "session",
          current.family_id,
          requestId,
        );
        return session(user, replacement);
      });
      // Reuse revocation must commit before emitting 401; throwing inside would roll it back.
      if (!result) throw unauthenticated();
      return result;
    },
    async logout(
      rawToken: string | undefined,
      csrfToken: string,
      requestId: string,
    ) {
      if (!rawToken || !/^[A-Za-z0-9_-]{64}$/.test(rawToken)) return;
      const existing = await findRefresh(pool, hashToken(rawToken));
      if (!existing) return;
      if (!verifyCsrfToken(config, csrfToken, existing.id))
        throw new AppError(
          403,
          "CSRF_REJECTED",
          "Forbidden",
          "The session request could not be verified.",
        );
      await withTransaction(pool, async (client) => {
        const user = await lockUser(client, existing.user_id);
        if (!user) return;
        const changed = await revokeFamily(client, existing.family_id);
        if (changed)
          await insertAudit(
            client,
            user.id,
            "auth.logged_out",
            "session",
            existing.family_id,
            requestId,
          );
      });
    },
  };
}
