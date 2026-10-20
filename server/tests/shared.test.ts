import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { loadConfig } from "../src/config/env.js";
import { createAccessTokens } from "../src/shared/tokens.js";
import { hashPassword, verifyPassword } from "../src/shared/passwords.js";
import {
  offsetOf,
  paginate,
  paginationSchema,
} from "../src/shared/pagination.js";
import { createLogger } from "../src/shared/logger.js";
import { createApp } from "../src/app.js";
import request from "supertest";

const environment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "test-signing-secret-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
};

describe("configuration", () => {
  it("validates required settings and applies consistent defaults", () => {
    expect(loadConfig(environment)).toMatchObject({
      port: 3000,
      host: "127.0.0.1",
      trustProxyHops: 0,
      maxActiveLoans: 3,
      loanDurationDays: 14,
      accessTokenTtlSeconds: 900,
    });
    expect(() => loadConfig({})).toThrow("DATABASE_URL");
    expect(() => loadConfig({ ...environment, JWT_SECRET: "short" })).toThrow(
      "JWT_SECRET",
    );
    expect(() =>
      loadConfig({
        ...environment,
        JWT_SECRET: "replace-me-with-at-least-32-characters",
      }),
    ).toThrow("JWT_SECRET");
  });
  it.each([
    { PORT: "0" },
    { PORT: "65536" },
    { PORT: "3.5" },
    { NODE_ENV: "staging" },
    { DATABASE_URL: "https://example.com" },
    { MAX_ACTIVE_LOANS: "-1" },
    { TRUST_PROXY_HOPS: "-1" },
    { TRUST_PROXY_HOPS: "2" },
    { TRUST_PROXY_HOPS: "0.5" },
    { ALLOWED_ORIGINS: "*" },
    { ALLOWED_ORIGINS: "https://example.com/path" },
  ])("rejects invalid input %j", (invalid) => {
    expect(() => loadConfig({ ...environment, ...invalid })).toThrow(
      "Invalid configuration",
    );
  });
  it("never includes credential values in errors", () => {
    const credential = "postgresql://admin:secret@example.com/db";
    try {
      loadConfig({ ...environment, DATABASE_URL: credential, PORT: "bad" });
    } catch (error) {
      expect(String(error)).not.toContain(credential);
      expect(String(error)).not.toContain("secret@");
    }
  });
});

describe("access tokens", () => {
  const config = loadConfig(environment);
  const tokens = createAccessTokens(config);
  it("signs and verifies a bounded token carrying only the user identity", async () => {
    const id = randomUUID();
    expect(await tokens.verify(await tokens.sign(id))).toBe(id);
  });
  it("rejects different signing keys and audiences", async () => {
    const token = await tokens.sign(randomUUID());
    await expect(
      createAccessTokens({
        ...config,
        jwtSecret: "another-signing-secret-at-least-thirty-two-characters",
      }).verify(token),
    ).rejects.toThrow();
    await expect(
      createAccessTokens({ ...config, jwtAudience: "another-app" }).verify(
        token,
      ),
    ).rejects.toThrow();
  });
  it("rejects expired tokens and unexpected algorithms", async () => {
    const key = new TextEncoder().encode(config.jwtSecret);
    for (const [alg, expiry] of [
      ["HS256", 1],
      ["HS384", Math.floor(Date.now() / 1000) + 1000],
    ] as const) {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg, typ: "JWT" })
        .setSubject(randomUUID())
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(key);
      await expect(tokens.verify(token)).rejects.toThrow();
    }
  });
});

describe("shared utilities", () => {
  it("hashes with Argon2id and checks real passwords", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(encoded, "correct horse battery staple")).toBe(
      true,
    );
    expect(await verifyPassword(encoded, "wrong password")).toBe(false);
  });
  it("normalizes bounded pagination", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(offsetOf({ page: 3, limit: 20 })).toBe(40);
    expect(paginate({ page: 3, limit: 20 }, 42)).toEqual({
      page: 3,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
    expect(paginationSchema.safeParse({ page: "1 OR 1=1" }).success).toBe(
      false,
    );
  });
  it("logs request metadata without headers, query strings, bodies or raw errors", async () => {
    let log = "";
    const logger = createLogger(
      { logLevel: "info" },
      {
        write(chunk: string) {
          log += chunk;
        },
      },
    );
    const application = createApp({
      config: loadConfig(environment),
      logger,
      checkReadiness: async () => true,
    });
    await request(application)
      .post("/api/v1/auth/login?token=query-secret")
      .set("Authorization", "Bearer auth-secret")
      .set("Cookie", "refresh=cookie-secret")
      .send({ password: "body-secret" });
    expect(log).toContain("request completed");
    for (const sensitive of [
      "query-secret",
      "auth-secret",
      "cookie-secret",
      "body-secret",
    ])
      expect(log).not.toContain(sensitive);
    expect(JSON.parse(log).route).toBe("unmatched");
  });
});
