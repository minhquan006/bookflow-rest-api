import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { withTransaction } from "../../db/pool.js";
import { AppError, unauthenticated } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/passwords.js";
import { createAccessTokens } from "../../shared/tokens.js";
import * as repository from "./repository.js";

export function createAuthService(config: AppConfig, pool: Pool) {
  const tokens = createAccessTokens(config);
  // Unknown accounts still pay the same password verification cost.
  let dummyHash: Promise<string> | undefined;
  return {
    async register(
      input: { fullName: string; email: string; password: string },
      requestId: string,
    ) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await withTransaction(pool, async (client) => {
          const user = await repository.insertUser(
            client,
            input.fullName,
            input.email,
            passwordHash,
          );
          await repository.insertAudit(
            client,
            user.id,
            "auth.registered",
            requestId,
          );
          return user;
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "users_email_key"
        ) {
          throw new AppError(
            409,
            "EMAIL_ALREADY_EXISTS",
            "Conflict",
            "This email is already registered.",
          );
        }
        throw error;
      }
    },
    async login(input: { email: string; password: string }, requestId: string) {
      dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
      const fallback = await dummyHash;
      return withTransaction(pool, async (client) => {
        const account = await repository.findAccount(client, input.email);
        const valid = await verifyPassword(
          account?.passwordHash ?? fallback,
          input.password,
        );
        if (!account || !valid || account.status !== "ACTIVE") {
          throw new AppError(
            401,
            "INVALID_CREDENTIALS",
            "Unauthorized",
            "Invalid email or password.",
          );
        }
        const { passwordHash: _passwordHash, ...user } = account;
        const id = randomUUID();
        const refreshToken = randomBytes(32).toString("base64url");
        const csrfPayload = `${id}.${randomBytes(32).toString("base64url")}`;
        const signature = createHmac("sha256", config.jwtSecret)
          .update(`bookflow-csrf:${csrfPayload}`)
          .digest("base64url");
        const csrfToken = `${csrfPayload}.${signature}`;
        const expiresAt = new Date(
          Date.now() + config.refreshTokenTtlDays * 86_400_000,
        );
        const accessToken = await tokens.sign(user.id);
        await repository.insertSession(client, {
          id,
          userId: user.id,
          familyId: randomUUID(),
          expiresAt,
          tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
        });
        await repository.insertAudit(
          client,
          user.id,
          "auth.logged_in",
          requestId,
        );
        return {
          data: {
            accessToken,
            tokenType: "Bearer" as const,
            expiresIn: config.accessTokenTtlSeconds,
            csrfToken,
            user,
          },
          refreshToken,
        };
      });
    },
    async me(id: string) {
      const user = await repository.findUser(pool, id);
      if (!user || user.status !== "ACTIVE") throw unauthenticated();
      return user;
    },
  };
}
