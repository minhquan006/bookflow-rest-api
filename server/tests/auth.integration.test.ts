import { createHash, createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { runMigrations } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/modules/auth/controller.js";
import { createAuthService } from "../src/modules/auth/service.js";
import { createLogger } from "../src/shared/logger.js";
import { verifyPassword } from "../src/shared/passwords.js";
import { createAccessTokens } from "../src/shared/tokens.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error(
    "TEST_DATABASE_URL must select a dedicated database ending in _test.",
  );
}
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});
const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
  max: 5,
  connectionTimeoutMillis: 5000,
});
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  JWT_SECRET: "test-signing-secret-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
function app(overrides: Partial<typeof config> = {}) {
  const settings = { ...config, ...overrides };
  return createApp({
    config: settings,
    logger: createLogger(settings),
    checkReadiness: async () => true,
    apiRouter: createAuthRouter(settings, pool),
  });
}
const password = "Auth-test-password-2026";
const input = () => ({
  fullName: "Test Reader",
  email: `${randomUUID()}@bookflow.test`,
  password,
});
const safeFields = [
  "id",
  "fullName",
  "email",
  "role",
  "status",
  "createdAt",
].sort();

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool);
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

describe("Auth HTTP with PostgreSQL", () => {
  it("registers a normalized MEMBER with Argon2id, safe DTO, audit and no session", async () => {
    const body = input();
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({
        ...body,
        email: ` ${body.email.toUpperCase()} `,
        fullName: "  Test Reader  ",
      });
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe("/api/v1/users/me");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(Object.keys(response.body.data).sort()).toEqual(safeFields);
    expect(response.body.data).toMatchObject({
      fullName: "Test Reader",
      email: body.email,
      role: "MEMBER",
      status: "ACTIVE",
    });
    const stored = (
      await pool.query("SELECT * FROM users WHERE id = $1", [
        response.body.data.id,
      ])
    ).rows[0];
    expect(stored.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored.password_hash, password)).toBe(true);
    expect(
      (
        await pool.query("SELECT * FROM audit_logs WHERE entity_id = $1", [
          stored.id,
        ])
      ).rows[0],
    ).toMatchObject({
      action: "auth.registered",
      actor_id: stored.id,
      request_id: response.headers["x-request-id"],
    });
    expect(
      (
        await pool.query("SELECT * FROM refresh_tokens WHERE user_id = $1", [
          stored.id,
        ])
      ).rowCount,
    ).toBe(0);
  });

  it.each([
    { role: "ADMIN" },
    { status: "DISABLED" },
    { id: randomUUID() },
    { fullName: " " },
    { fullName: "x".repeat(121) },
    { email: "invalid" },
    { email: `${"a".repeat(250)}@test.test` },
    { password: "short" },
    { password: "x".repeat(129) },
    { password: null },
  ])("rejects invalid registration or mass assignment: %j", async (invalid) => {
    const body = { ...input(), ...invalid };
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send(body);
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.text).not.toContain(password);
    expect(
      (await pool.query("SELECT id FROM users WHERE email = $1", [body.email]))
        .rowCount,
    ).toBe(0);
  });

  it("handles concurrent normalized duplicate registrations with one 201 and one 409", async () => {
    const application = app();
    const body = input();
    const responses = await Promise.all([
      request(application).post("/api/v1/auth/register").send(body),
      request(application)
        .post("/api/v1/auth/register")
        .send({ ...body, email: ` ${body.email.toUpperCase()} ` }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body.code).toBe(
      "EMAIL_ALREADY_EXISTS",
    );
    expect(
      (await pool.query("SELECT * FROM users WHERE email = $1", [body.email]))
        .rowCount,
    ).toBe(1);
  });

  it("logs in, signs the JWT, stores only a refresh hash and binds signed CSRF to its session", async () => {
    const application = app();
    const body = input();
    const registered = await request(application)
      .post("/api/v1/auth/register")
      .send(body);
    const response = await request(application)
      .post("/api/v1/auth/login")
      .send({ email: ` ${body.email.toUpperCase()} `, password });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
      user: registered.body.data,
    });
    expect(Object.keys(response.body.data).sort()).toEqual(
      ["accessToken", "tokenType", "expiresIn", "csrfToken", "user"].sort(),
    );
    const token = response.body.data.accessToken;
    expect(await createAccessTokens(config).verify(token)).toBe(
      registered.body.data.id,
    );
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    expect(payload).toMatchObject({
      sub: registered.body.data.id,
      iss: config.jwtIssuer,
      aud: config.jwtAudience,
    });
    expect(payload.exp - payload.iat).toBe(900);
    expect(payload).not.toHaveProperty("role");
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const refreshCookie = cookies.find((c) =>
      c.startsWith("bookflow_refresh="),
    )!;
    const csrfCookie = cookies.find((c) => c.startsWith("bookflow_csrf="))!;
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("Path=/api/v1/auth");
    expect(csrfCookie).toContain("Path=/;");
    expect(csrfCookie).not.toContain("HttpOnly");
    for (const cookie of cookies) {
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).not.toContain("Secure");
    }
    const raw = refreshCookie.split(";")[0]!.split("=")[1]!;
    const session = (
      await pool.query("SELECT * FROM refresh_tokens WHERE user_id = $1", [
        registered.body.data.id,
      ])
    ).rows[0];
    expect(session.token_hash).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
    expect(JSON.stringify(session)).not.toContain(raw);
    expect(
      new Date(session.expires_at).getTime() -
        new Date(session.created_at).getTime(),
    ).toBeCloseTo(7 * 86_400_000, -3);
    const csrf = response.body.data.csrfToken;
    expect(decodeURIComponent(csrfCookie.split(";")[0]!.split("=")[1]!)).toBe(
      csrf,
    );
    const [id, nonce, signature] = csrf.split(".");
    expect(id).toBe(session.id);
    expect(signature).toBe(
      createHmac("sha256", config.jwtSecret)
        .update(`bookflow-csrf:${id}.${nonce}`)
        .digest("base64url"),
    );
    const me = await request(application)
      .get("/api/v1/users/me")
      .auth(token, { type: "bearer" });
    expect(me.status).toBe(200);
    expect(me.body.data).toEqual(registered.body.data);
    expect(me.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await pool.query(
          "SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'auth.logged_in'",
          [registered.body.data.id],
        )
      ).rowCount,
    ).toBe(1);
  });

  it("uses generic credentials errors for wrong passwords, unknown and disabled accounts", async () => {
    const application = app();
    const body = input();
    const registered = await request(application)
      .post("/api/v1/auth/register")
      .send(body);
    const wrong = await request(application)
      .post("/api/v1/auth/login")
      .send({ email: body.email, password: "wrong" });
    const missing = await request(application)
      .post("/api/v1/auth/login")
      .send({ email: input().email, password });
    await pool.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [
      registered.body.data.id,
    ]);
    const disabled = await request(application)
      .post("/api/v1/auth/login")
      .send({ email: body.email, password });
    for (const response of [wrong, missing, disabled]) {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: "INVALID_CREDENTIALS",
        detail: "Invalid email or password.",
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
    expect(
      (
        await pool.query("SELECT * FROM refresh_tokens WHERE user_id = $1", [
          registered.body.data.id,
        ])
      ).rowCount,
    ).toBe(0);
  });

  it("immediately reflects role changes and rejects disabled or deleted users with an existing JWT", async () => {
    const application = app();
    const body = input();
    const registered = await request(application)
      .post("/api/v1/auth/register")
      .send(body);
    const id = registered.body.data.id;
    const token = await createAccessTokens(config).sign(id);
    for (const role of ["ADMIN", "LIBRARIAN", "MEMBER"]) {
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
      const response = await request(application)
        .get("/api/v1/users/me")
        .auth(token, { type: "bearer" });
      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(role);
      expect(Object.keys(response.body.data).sort()).toEqual(safeFields);
    }
    await pool.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [
      id,
    ]);
    expect(
      (
        await request(application)
          .get("/api/v1/users/me")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(401);
    const deleted = randomUUID();
    expect(
      (
        await request(application)
          .get("/api/v1/users/me")
          .auth(await createAccessTokens(config).sign(deleted), {
            type: "bearer",
          })
      ).status,
    ).toBe(401);
  });

  it("rejects absent, malformed, expired, tampered, wrong issuer and wrong audience JWTs", async () => {
    const application = app();
    const id = randomUUID();
    const tokens = [
      undefined,
      "invalid",
      await createAccessTokens({ ...config, accessTokenTtlSeconds: -1 }).sign(
        id,
      ),
      await createAccessTokens({ ...config, jwtIssuer: "other" }).sign(id),
      await createAccessTokens({ ...config, jwtAudience: "other" }).sign(id),
      await createAccessTokens({
        ...config,
        jwtSecret: "another-secret-at-least-thirty-two-characters",
      }).sign(id),
    ];
    for (const token of tokens) {
      const req = request(application).get("/api/v1/users/me");
      if (token) req.auth(token, { type: "bearer" });
      const response = await req;
      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHENTICATED");
    }
  });

  it("sets Secure on HTTPS cookies behind the configured trusted proxy", async () => {
    const application = app({ trustProxyHops: 1 });
    const body = input();
    await request(application)
      .post("/api/v1/auth/register")
      .send(body)
      .expect(201);
    const response = await request(application)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-Proto", "https")
      .send({ email: body.email, password });
    expect(response.status).toBe(200);
    for (const cookie of response.headers["set-cookie"] as unknown as string[])
      expect(cookie).toContain("Secure");
  });

  it("validates login and enforces the auth IP rate limit", async () => {
    const application = app();
    for (let i = 0; i < 10; i++) {
      const response = await request(application)
        .post("/api/v1/auth/login")
        .send({ email: "invalid", password: "", role: "ADMIN" });
      expect(response.status).toBe(400);
    }
    const limited = await request(application)
      .post("/api/v1/auth/login")
      .send({ email: input().email, password });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });

  it("rolls back users/sessions when their audit insert fails", async () => {
    const service = createAuthService(config, pool);
    const body = input();
    await expect(service.register(body, "")).rejects.toMatchObject({
      code: "23514",
    });
    expect(
      (await pool.query("SELECT id FROM users WHERE email = $1", [body.email]))
        .rowCount,
    ).toBe(0);
    const user = await service.register(body, randomUUID());
    await expect(
      service.login({ email: body.email, password }, ""),
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      (
        await pool.query("SELECT id FROM refresh_tokens WHERE user_id = $1", [
          user.id,
        ])
      ).rowCount,
    ).toBe(0);
  });

  it("keeps database failures as server errors without exposing connection details", async () => {
    const token = await createAccessTokens(config).sign(randomUUID());
    const spy = vi
      .spyOn(pool, "query")
      .mockRejectedValueOnce(new Error("postgresql://secret:password@host/db"));
    try {
      const response = await request(app())
        .get("/api/v1/users/me")
        .auth(token, { type: "bearer" });
      expect(response.status).toBe(500);
      expect(response.text).not.toContain("password");
    } finally {
      spy.mockRestore();
    }
  });
});
