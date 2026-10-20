import request from "supertest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/shared/logger.js";
import { createAuthentication } from "../src/middleware/auth.js";
import { createCategoriesRouter } from "../src/modules/categories/categories.routes.js";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate.js";
import { seedDemo } from "../src/db/seed.js";
import { createCategory } from "../src/modules/categories/categories-write.service.js";
import type { Principal } from "../src/middleware/context.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error("A dedicated TEST_DATABASE_URL ending in _test is required.");
}

const schema = `catalog_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});
const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});

let librarian: Principal;
let administrator: Principal;
let member: Principal;

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool);
  await seedDemo(pool, {
    nodeEnv: "test",
    password: "Local-only-catalog-test-password-2026",
  });

  const users = await pool.query<Principal>("SELECT id, role FROM users");
  librarian = users.rows.find((user) => user.role === "LIBRARIAN")!;
  administrator = users.rows.find((user) => user.role === "ADMIN")!;
  member = users.rows.find((user) => user.role === "MEMBER")!;
});

afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

describe("Category creation with PostgreSQL", () => {
  it("allows a librarian and commits the category with its audit", async () => {
    const requestId = randomUUID();
    const category = await createCategory(
      pool,
      librarian,
      { name: "Science", slug: "science" },
      requestId,
    );

    const stored = await pool.query(
      "SELECT name, slug FROM categories WHERE id = $1",
      [category.id],
    );
    expect(stored.rows).toEqual([{ name: "Science", slug: "science" }]);

    const audit = await pool.query(
      `SELECT actor_id, action, entity_type, request_id
       FROM audit_logs WHERE entity_id = $1`,
      [category.id],
    );
    expect(audit.rows).toEqual([
      {
        actor_id: librarian.id,
        action: "CATEGORY_CREATED",
        entity_type: "category",
        request_id: requestId,
      },
    ]);
    expect(new Date(category.createdAt).toISOString()).toBe(category.createdAt);
  });

  it("allows an administrator to create a category", async () => {
    const result = await createCategory(
      pool,
      administrator,
      { name: "History", slug: "history" },
      randomUUID(),
    );
    expect(result.name).toBe("History");
  });

  it("rejects MEMBER without creating a category or audit", async () => {
    const requestId = randomUUID();
    await expect(
      createCategory(
        pool,
        member,
        { name: "Forbidden category", slug: "forbidden-category" },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    const categories = await pool.query(
      "SELECT id FROM categories WHERE slug = $1",
      ["forbidden-category"],
    );
    const audit = await pool.query(
      "SELECT id FROM audit_logs WHERE request_id = $1",
      [requestId],
    );
    expect(categories.rowCount).toBe(0);
    expect(audit.rowCount).toBe(0);
  });

  it("rejects duplicate names case-insensitively and duplicate slugs", async () => {
    await createCategory(
      pool,
      librarian,
      { name: "Unique Subject", slug: "unique-subject" },
      randomUUID(),
    );

    for (const input of [
      { name: "UNIQUE SUBJECT", slug: "another-slug" },
      { name: "Different Subject", slug: "unique-subject" },
    ]) {
      const requestId = randomUUID();
      await expect(
        createCategory(pool, librarian, input, requestId),
      ).rejects.toMatchObject({
        status: 409,
        code: "CATEGORY_ALREADY_EXISTS",
      });

      const audit = await pool.query(
        "SELECT id FROM audit_logs WHERE request_id = $1",
        [requestId],
      );
      expect(audit.rowCount).toBe(0);
    }
  });

  it("rolls back the category when the audit insert fails", async () => {
    // Deliberately exceed the audit request_id constraint in this test.
    await expect(
      createCategory(
        pool,
        librarian,
        { name: "Rollback Subject", slug: "rollback-subject" },
        "x".repeat(129),
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const result = await pool.query(
      "SELECT id FROM categories WHERE slug = $1",
      ["rollback-subject"],
    );
    expect(result.rowCount).toBe(0);
  });
});
const httpConfig = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  JWT_SECRET: "catalog-integration-test-secret-at-least-32-characters",
  LOG_LEVEL: "silent",
});
const authentication = createAuthentication(httpConfig, pool);
const httpApp = createApp({
  config: httpConfig,
  logger: createLogger(httpConfig),
  checkReadiness: async () => true,
  apiRouter: createCategoriesRouter(pool, authentication.authenticate),
});

describe("Category creation over HTTP", () => {
  it("returns 401 without a token", async () => {
    const response = await request(httpApp)
      .post("/api/v1/categories")
      .send({ name: "No token", slug: "no-token" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a valid MEMBER token", async () => {
    const token = await authentication.accessTokens.sign(member.id);
    const response = await request(httpApp)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Member attempt", slug: "member-attempt" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("returns 201, Location and an audit for a librarian", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const response = await request(httpApp)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  HTTP Category  ", slug: "http-category" });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("HTTP Category");
    expect(response.headers.location).toBe(
      `/api/v1/categories/${response.body.data.id}`,
    );

    const audit = await pool.query(
      `SELECT actor_id, request_id FROM audit_logs WHERE entity_id = $1`,
      [response.body.data.id],
    );
    expect(audit.rows).toEqual([
      {
        actor_id: librarian.id,
        request_id: response.headers["x-request-id"],
      },
    ]);
  });

  it("rejects invalid input and extra fields with 400", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);

    for (const body of [
      { name: "", slug: "empty-name" },
      { name: "Invalid slug", slug: "Invalid Slug" },
      { name: "Extra field", slug: "extra-field", role: "ADMIN" },
    ]) {
      const response = await request(httpApp)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 409 for duplicates without exposing database details", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const body = { name: "HTTP Duplicate", slug: "http-duplicate" };

    const first = await request(httpApp)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(201);

    const duplicate = await request(httpApp)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("CATEGORY_ALREADY_EXISTS");
    expect(duplicate.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(duplicate.text).not.toContain("categories_name_normalized_unique");
    expect(duplicate.body).not.toHaveProperty("stack");
  });

  it("rejects an existing token after the account is disabled", async () => {
    const token = await authentication.accessTokens.sign(administrator.id);

    await pool.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [
      administrator.id,
    ]);

    try {
      const response = await request(httpApp)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Disabled attempt", slug: "disabled-attempt" });

      expect(response.status).toBe(401);
    } finally {
      await pool.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [
        administrator.id,
      ]);
    }
  });
});
