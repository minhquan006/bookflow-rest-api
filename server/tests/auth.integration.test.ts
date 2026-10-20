import { randomUUID, createHash } from "node:crypto";
import { Router } from "express";
import { Pool } from "pg";
import request, { type Response } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { runMigrations } from "../src/db/migrate.js";
import { createAuthRouter } from "../src/modules/auth/index.js";
import { createUsersRouter } from "../src/modules/users/index.js";
import { createUsersService } from "../src/modules/users/users.service.js";
import { hashPassword, verifyPassword } from "../src/shared/passwords.js";
import { createLogger } from "../src/shared/logger.js";
import { createAccessTokens } from "../src/shared/tokens.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error(
    "Auth integration tests require a dedicated TEST_DATABASE_URL ending _test.",
  );
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: databaseUrl });
const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
  max: 8,
  statement_timeout: 8000,
});
const password = "Synthetic-auth-test-password-2026";
const origin = "http://localhost:5173";
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  JWT_SECRET: "Synthetic-integration-signing-key-at-least-32-characters",
  LOG_LEVEL: "silent",
  ALLOWED_ORIGINS: origin,
});
const tokens = createAccessTokens(config);
let passwordHash: string;
let app: ReturnType<typeof createApp>;
let memberId: string;
let adminId: string;

function session(response: Response) {
  expect(response.status).toBe(200);
  const headers: string[] = response.headers[
    "set-cookie"
  ] as unknown as string[];
  const cookies = Object.fromEntries(
    headers.map((header) => {
      const pair = header.split(";")[0]!;
      const equals = pair.indexOf("=");
      return [
        pair.slice(0, equals),
        decodeURIComponent(pair.slice(equals + 1)),
      ];
    }),
  );
  return {
    cookie: `bookflow_refresh=${cookies.bookflow_refresh}; bookflow_csrf=${cookies.bookflow_csrf}`,
    csrf: cookies.bookflow_csrf!,
    raw: cookies.bookflow_refresh!,
    access: response.body.data.accessToken as string,
    headers,
  };
}

async function login(email = "member@auth.test") {
  return request(app).post("/api/v1/auth/login").send({ email, password });
}
function refresh(current: ReturnType<typeof session>) {
  return request(app)
    .post("/api/v1/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", current.cookie)
    .set("X-CSRF-Token", current.csrf)
    .send({});
}
function logout(current: ReturnType<typeof session>) {
  return request(app)
    .post("/api/v1/auth/logout")
    .set("Origin", origin)
    .set("Cookie", current.cookie)
    .set("X-CSRF-Token", current.csrf)
    .send({});
}

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool);
  passwordHash = await hashPassword(password);
});
beforeEach(async () => {
  // The pool search_path is a random schema created above, never public or the dev database.
  await pool.query("TRUNCATE users CASCADE");
  memberId = randomUUID();
  adminId = randomUUID();
  await pool.query(
    "INSERT INTO users (id,full_name,email,password_hash,role) VALUES ($1,'Synthetic Member','member@auth.test',$3,'MEMBER'),($2,'Synthetic Admin','admin@auth.test',$3,'ADMIN')",
    [memberId, adminId, passwordHash],
  );
  const router = Router();
  router.use(createAuthRouter({ pool, config }));
  router.use(createUsersRouter({ pool, config }));
  app = createApp({
    config,
    logger: createLogger(config),
    checkReadiness: async () => true,
    apiRouter: router,
    rateLimit: 1000,
  });
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

describe("Auth HTTP and PostgreSQL", () => {
  it("registers only MEMBER, normalizes email and hashes the password without returning secrets", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      fullName: "  New Member  ",
      email: "  NEW@AUTH.TEST  ",
      password,
    });
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe("/api/v1/users/me");
    expect(response.body.data).toMatchObject({
      fullName: "New Member",
      email: "new@auth.test",
      role: "MEMBER",
      status: "ACTIVE",
    });
    expect(Object.keys(response.body.data).sort()).toEqual(
      ["id", "fullName", "email", "role", "status", "createdAt"].sort(),
    );
    const stored = (
      await pool.query(
        "SELECT password_hash FROM users WHERE email='new@auth.test'",
      )
    ).rows[0];
    expect(stored.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored.password_hash, password)).toBe(true);
    expect(
      (await pool.query("SELECT action FROM audit_logs")).rows[0].action,
    ).toBe("auth.registered");
  });
  it("rejects mass assignment, invalid email and short passwords without inserting users", async () => {
    for (const extra of [
      { role: "ADMIN" },
      { status: "ACTIVE" },
      { email: "invalid" },
      { password: "short" },
    ]) {
      const result = await request(app)
        .post("/api/v1/auth/register")
        .send({
          fullName: "New Member",
          email: "new@auth.test",
          password,
          ...extra,
        });
      expect(result.status).toBe(400);
    }
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM users")).rows[0]
        .count,
    ).toBe(2);
  });
  it("maps duplicate normalized email to 409", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ fullName: "Duplicate", email: " MEMBER@AUTH.TEST ", password });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("EMAIL_IN_USE");
  });
  it("rolls registration and audit back together on an audit failure", async () => {
    await pool.query(
      "CREATE FUNCTION reject_auth_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_auth_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_auth_audit()",
    );
    try {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({ fullName: "Rollback", email: "rollback@auth.test", password });
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        "synthetic audit failure",
      );
      expect(
        (
          await pool.query(
            "SELECT 1 FROM users WHERE email='rollback@auth.test'",
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER reject_auth_audit ON audit_logs");
      await pool.query("DROP FUNCTION reject_auth_audit()");
    }
  });
  it("logs in with safe DTO, short JWT and correctly scoped cookies; stores only a refresh hash", async () => {
    const response = await login(" MEMBER@AUTH.TEST ");
    const current = session(response);
    expect(response.body.data).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
      user: { id: memberId, role: "MEMBER" },
    });
    expect(await tokens.verify(current.access)).toBe(memberId);
    const refreshCookie = current.headers.find((header) =>
      header.startsWith("bookflow_refresh="),
    )!;
    expect(refreshCookie).toContain("Path=/api/v1/auth;");
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Strict");
    const csrfCookie = current.headers.find((header) =>
      header.startsWith("bookflow_csrf="),
    )!;
    expect(csrfCookie).toContain("Path=/;");
    expect(csrfCookie).not.toContain("HttpOnly");
    const stored = (await pool.query("SELECT token_hash FROM refresh_tokens"))
      .rows[0].token_hash;
    expect(stored).toBe(createHash("sha256").update(current.raw).digest("hex"));
    expect(stored).not.toBe(current.raw);
  });
  it("returns the same 401 for unknown email, wrong password and disabled users", async () => {
    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "member@auth.test", password: "incorrect" });
    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unknown@auth.test", password });
    await pool.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
      memberId,
    ]);
    const disabled = await login();
    for (const response of [wrong, unknown, disabled]) {
      expect(response.status).toBe(401);
      expect(response.body.detail).toBe("The email or password is incorrect.");
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });
  it("bounds brute force by normalized account and source IP", async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email: "member@auth.test", password: "incorrect" })
        ).status,
      ).toBe(401);
    }
    const limited = await login();
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });
  it("rotates refresh tokens atomically and returns a new CSRF token", async () => {
    const original = session(await login());
    const rotated = session(await refresh(original));
    expect(rotated.raw).not.toBe(original.raw);
    expect(rotated.csrf).not.toBe(original.csrf);
    const records = (
      await pool.query(
        "SELECT revoked_at,replaced_by FROM refresh_tokens ORDER BY created_at",
      )
    ).rows;
    expect(records).toHaveLength(2);
    expect(records[0].revoked_at).not.toBeNull();
    expect(records[0].replaced_by).not.toBeNull();
    expect(records[1].revoked_at).toBeNull();
    expect((await refresh(rotated)).status).toBe(200);
  });
  it("commits family revocation on old-token reuse and rejects the replacement", async () => {
    const original = session(await login());
    const replacement = session(await refresh(original));
    expect((await refresh(original)).status).toBe(401);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL",
        )
      ).rowCount,
    ).toBe(0);
    expect((await refresh(replacement)).status).toBe(401);
  });
  it("serializes simultaneous refresh requests; reuse revokes the winner's family", async () => {
    const original = session(await login());
    const responses = await Promise.all([refresh(original), refresh(original)]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL",
        )
      ).rowCount,
    ).toBe(0);
  });
  it("requires a trusted Origin, matching cookie/header, signature and session binding", async () => {
    const first = session(await login());
    const other = session(await login("admin@auth.test"));
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Cookie", first.cookie)
          .set("X-CSRF-Token", first.csrf)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", "https://untrusted.example")
          .set("Cookie", first.cookie)
          .set("X-CSRF-Token", first.csrf)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", origin)
          .set("Cookie", first.cookie)
          .set("X-CSRF-Token", `${first.csrf}x`)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", origin)
          .set(
            "Cookie",
            `bookflow_refresh=${first.raw}; bookflow_csrf=${other.csrf}`,
          )
          .set("X-CSRF-Token", other.csrf)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL",
        )
      ).rowCount,
    ).toBe(2);
  });
  it("rejects expired refresh sessions and clears browser cookies", async () => {
    const current = session(await login());
    await pool.query(
      "UPDATE refresh_tokens SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day'",
    );
    const response = await refresh(current);
    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toHaveLength(2);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL",
        )
      ).rowCount,
    ).toBe(0);
  });
  it("logs out idempotently, clears both original cookie paths and preserves issued JWT semantics", async () => {
    const current = session(await login());
    const first = await logout(current);
    expect(first.status).toBe(204);
    expect(first.text).toBe("");
    const clearCookies = first.headers["set-cookie"] as unknown as string[];
    expect(
      clearCookies.find((value) => value.startsWith("bookflow_refresh=")),
    ).toContain("Path=/api/v1/auth;");
    expect(
      clearCookies.find((value) => value.startsWith("bookflow_csrf=")),
    ).toContain("Path=/;");
    expect((await logout(current)).status).toBe(204);
    expect((await refresh(current)).status).toBe(401);
    expect(await tokens.verify(current.access)).toBe(memberId);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM audit_logs WHERE action='auth.logged_out'",
        )
      ).rowCount,
    ).toBe(1);
  });
});

describe("Users authorization and administrator invariants", () => {
  it("reads own safe profile and rejects missing/tampered/expired/wrong-audience tokens", async () => {
    const access = await tokens.sign(memberId);
    const profile = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${access}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.id).toBe(memberId);
    expect(profile.body.data.password_hash).toBeUndefined();
    expect(profile.body.data.passwordHash).toBeUndefined();
    expect((await request(app).get("/api/v1/users/me")).status).toBe(401);
    const key = new TextEncoder().encode(config.jwtSecret);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(memberId)
      .setIssuer(config.jwtIssuer)
      .setAudience(config.jwtAudience)
      .setIssuedAt()
      .setExpirationTime(1)
      .sign(key);
    const wrongAudience = await createAccessTokens({
      ...config,
      jwtAudience: "wrong",
    }).sign(memberId);
    for (const token of [`${access}tampered`, expired, wrongAudience])
      expect(
        (
          await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", `Bearer ${token}`)
        ).status,
      ).toBe(401);
  });
  it("reads current role and disabled status even with an unexpired access token", async () => {
    const access = await tokens.sign(memberId);
    expect(
      (
        await request(app)
          .get("/api/v1/users")
          .set("Authorization", `Bearer ${access}`)
      ).status,
    ).toBe(403);
    await pool.query("UPDATE users SET role='ADMIN' WHERE id=$1", [memberId]);
    expect(
      (
        await request(app)
          .get("/api/v1/users")
          .set("Authorization", `Bearer ${access}`)
      ).status,
    ).toBe(200);
    await pool.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
      memberId,
    ]);
    expect(
      (
        await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${access}`)
      ).status,
    ).toBe(401);
  });
  it("supports bounded pagination with safe DTOs and rejects unknown query/body fields", async () => {
    const access = await tokens.sign(adminId);
    const result = await request(app)
      .get("/api/v1/users?page=1&limit=1")
      .set("Authorization", `Bearer ${access}`);
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(JSON.stringify(result.body)).not.toContain(passwordHash);
    expect(
      (
        await request(app)
          .get("/api/v1/users?limit=101")
          .set("Authorization", `Bearer ${access}`)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/v1/users?q=admin")
          .set("Authorization", `Bearer ${access}`)
      ).status,
    ).toBe(400);
    for (const body of [{}, { email: "x@auth.test" }, { role: "INVALID" }])
      expect(
        (
          await request(app)
            .patch(`/api/v1/users/${memberId}`)
            .set("Authorization", `Bearer ${access}`)
            .send(body)
        ).status,
      ).toBe(400);
  });
  it("changes role/status atomically, invalidates refresh sessions and records an audit event", async () => {
    const current = session(await login());
    const access = await tokens.sign(adminId);
    const result = await request(app)
      .patch(`/api/v1/users/${memberId}`)
      .set("Authorization", `Bearer ${access}`)
      .send({ role: "LIBRARIAN", status: "DISABLED" });
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      role: "LIBRARIAN",
      status: "DISABLED",
    });
    expect(
      (
        await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${current.access}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL",
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (await pool.query("SELECT 1 FROM audit_logs WHERE action='user.updated'"))
        .rowCount,
    ).toBe(1);
  });
  it("prevents removing the last active administrator", async () => {
    const access = await tokens.sign(adminId);
    for (const body of [{ role: "MEMBER" }, { status: "DISABLED" }]) {
      const response = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set("Authorization", `Bearer ${access}`)
        .send(body);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("LAST_ACTIVE_ADMIN");
    }
  });
  it("preserves one administrator during competing self-demotions on independent connections", async () => {
    await pool.query("UPDATE users SET role='ADMIN' WHERE id=$1", [memberId]);
    const service = createUsersService(pool);
    const results = await Promise.allSettled([
      service.patch(adminId, adminId, { role: "MEMBER" }, randomUUID()),
      service.patch(memberId, memberId, { role: "MEMBER" }, randomUUID()),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect(failure?.status === "rejected" && failure.reason.code).toBe(
      "LAST_ACTIVE_ADMIN",
    );
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM users WHERE role='ADMIN' AND status='ACTIVE'",
        )
      ).rows[0].total,
    ).toBe(1);
  });
  it("returns 404 for an absent user and 400 for a malformed UUID", async () => {
    const access = await tokens.sign(adminId);
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${randomUUID()}`)
          .set("Authorization", `Bearer ${access}`)
          .send({ role: "MEMBER" })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch("/api/v1/users/not-a-uuid")
          .set("Authorization", `Bearer ${access}`)
          .send({ role: "MEMBER" })
      ).status,
    ).toBe(400);
  });
});
