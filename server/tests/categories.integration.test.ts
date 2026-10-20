import { createBooksRouter } from "../src/modules/books/books.routes.js";
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
  apiRouter: createCategoriesRouter(pool, authentication.authenticate).use(
    createBooksRouter(pool, authentication.authenticate),
  ),
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
async function bookInput() {
  const category = await pool.query<{ id: string }>(
    "SELECT id FROM categories ORDER BY id LIMIT 1",
  );
  return {
    categoryId: category.rows[0]!.id,
    isbn: null as string | null,
    title: "HTTP Test Book",
    author: "Test Author",
    description: "Integration test data.",
  };
}

describe("Book creation over HTTP", () => {
  it("returns 401 without authentication", async () => {
    const response = await request(httpApp)
      .post("/api/v1/books")
      .send(await bookInput());

    expect(response.status).toBe(401);
  });

  it("returns 403 for MEMBER", async () => {
    const token = await authentication.accessTokens.sign(member.id);
    const response = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send(await bookInput());

    expect(response.status).toBe(403);
  });

  it("creates a book with Location, ETag and matching audit", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const input = await bookInput();
    input.title = "  Trimmed Book  ";
    input.author = "  Trimmed Author  ";

    const response = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send(input);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      categoryId: input.categoryId,
      title: "Trimmed Book",
      author: "Trimmed Author",
      isbn: null,
      archivedAt: null,
      version: 1,
    });
    expect(response.headers.location).toBe(
      `/api/v1/books/${response.body.data.id}`,
    );
    expect(response.headers.etag).toBe(`"book-${response.body.data.id}-v1"`);

    const stored = await pool.query("SELECT title FROM books WHERE id = $1", [
      response.body.data.id,
    ]);
    expect(stored.rows).toEqual([{ title: "Trimmed Book" }]);

    const audit = await pool.query(
      `SELECT actor_id, action, request_id
       FROM audit_logs WHERE entity_id = $1`,
      [response.body.data.id],
    );
    expect(audit.rows).toEqual([
      {
        actor_id: librarian.id,
        action: "BOOK_CREATED",
        request_id: response.headers["x-request-id"],
      },
    ]);
  });

  it("allows ADMIN and multiple books without an ISBN", async () => {
    const token = await authentication.accessTokens.sign(administrator.id);

    for (const title of ["No ISBN One", "No ISBN Two"]) {
      const response = await request(httpApp)
        .post("/api/v1/books")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...(await bookInput()), title });

      expect(response.status).toBe(201);
      expect(response.body.data.isbn).toBeNull();
    }
  });

  it("rejects duplicate ISBN with 409 and no extra audit", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const input = { ...(await bookInput()), isbn: "9780132350884" };

    const first = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send(input);
    expect(first.status).toBe(201);

    const duplicate = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...input, title: "Duplicate ISBN Attempt" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("ISBN_ALREADY_EXISTS");

    const audit = await pool.query(
      "SELECT id FROM audit_logs WHERE request_id = $1",
      [duplicate.headers["x-request-id"]],
    );
    expect(audit.rowCount).toBe(0);
  });

  it("rejects a missing category without creating a book or audit", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const input = {
      ...(await bookInput()),
      categoryId: randomUUID(),
      title: "Missing Category Attempt",
    };

    const response = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send(input);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_CATEGORY");

    const stored = await pool.query("SELECT id FROM books WHERE title = $1", [
      input.title,
    ]);
    const audit = await pool.query(
      "SELECT id FROM audit_logs WHERE request_id = $1",
      [response.headers["x-request-id"]],
    );
    expect(stored.rowCount).toBe(0);
    expect(audit.rowCount).toBe(0);
  });

  it("rejects invalid fields and client-supplied internal fields", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const input = await bookInput();

    for (const body of [
      { ...input, title: " " },
      { ...input, author: "" },
      { ...input, isbn: "invalid-isbn" },
      { ...input, categoryId: "invalid-uuid" },
      { ...input, description: "x".repeat(5001) },
      { ...input, version: 99 },
      { ...input, archivedAt: "2026-01-01T00:00:00Z" },
    ]) {
      const response = await request(httpApp)
        .post("/api/v1/books")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });
});
describe("Book details and availability over HTTP", () => {
  const seedBookId = "10000000-0000-4000-8000-000000000001";

  it("returns metadata and ETag without embedding availability", async () => {
    const response = await request(httpApp).get(`/api/v1/books/${seedBookId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(seedBookId);
    expect(response.body.data).not.toHaveProperty("availableCopies");
    expect(response.headers.etag).toBe(`"book-${seedBookId}-v1"`);
    expect(response.headers["cache-control"]).toBe("private, no-cache");
    expect(response.headers.vary).toContain("Authorization");
  });

  it("returns an empty 304 when If-None-Match matches", async () => {
    const first = await request(httpApp).get(`/api/v1/books/${seedBookId}`);
    expect(first.status).toBe(200);

    for (const header of [
      first.headers.etag,
      `W/${first.headers.etag}`,
      `"different-tag", ${first.headers.etag}`,
      "*",
    ]) {
      const response = await request(httpApp)
        .get(`/api/v1/books/${seedBookId}`)
        .set("If-None-Match", header);

      expect(response.status).toBe(304);
      expect(response.text).toBe("");
      expect(response.headers.etag).toBe(first.headers.etag);
    }
  });

  it("returns 200 for a nonmatching ETag", async () => {
    const response = await request(httpApp)
      .get(`/api/v1/books/${seedBookId}`)
      .set("If-None-Match", '"old-version"');

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(seedBookId);
  });

  it("returns 400 for invalid UUID and 404 for missing books", async () => {
    for (const suffix of ["", "/availability"]) {
      const invalid = await request(httpApp).get(
        `/api/v1/books/not-a-uuid${suffix}`,
      );
      expect(invalid.status).toBe(400);

      const missing = await request(httpApp).get(
        `/api/v1/books/${randomUUID()}${suffix}`,
      );
      expect(missing.status).toBe(404);
    }
  });

  it("checks archived visibility before evaluating conditional GET", async () => {
    const staffToken = await authentication.accessTokens.sign(librarian.id);
    const memberToken = await authentication.accessTokens.sign(member.id);
    const created = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ ...(await bookInput()), title: "Archived Visibility Test" });
    expect(created.status).toBe(201);

    const id = created.body.data.id;
    await pool.query(
      "UPDATE books SET archived_at = now(), version = version + 1 WHERE id = $1",
      [id],
    );

    for (const suffix of ["", "/availability"]) {
      const guest = await request(httpApp)
        .get(`/api/v1/books/${id}${suffix}`)
        .set("If-None-Match", "*");
      expect(guest.status).toBe(404);

      const memberResponse = await request(httpApp)
        .get(`/api/v1/books/${id}${suffix}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .set("If-None-Match", "*");
      expect(memberResponse.status).toBe(404);

      for (const actor of [librarian, administrator]) {
        const token = await authentication.accessTokens.sign(actor.id);
        const staffResponse = await request(httpApp)
          .get(`/api/v1/books/${id}${suffix}`)
          .set("Authorization", `Bearer ${token}`);
        expect(staffResponse.status).toBe(200);
      }
    }
  });

  it("counts only AVAILABLE copies without an open loan and does not cache availability", async () => {
    const token = await authentication.accessTokens.sign(librarian.id);
    const created = await request(httpApp)
      .post("/api/v1/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...(await bookInput()), title: "Availability Test" });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    for (const condition of [
      "AVAILABLE",
      "AVAILABLE",
      "MAINTENANCE",
      "RETIRED",
    ]) {
      await pool.query(
        `INSERT INTO book_copies (book_id, barcode, condition_status)
         VALUES ($1, $2, $3)`,
        [id, randomUUID(), condition],
      );
    }

    const before = await request(httpApp).get(
      `/api/v1/books/${id}/availability`,
    );
    expect(before.status).toBe(200);
    expect(before.body.data.availableCopies).toBe(2);
    expect(before.headers["cache-control"]).toBe("no-store");

    const copy = await pool.query<{ id: string }>(
      `SELECT id FROM book_copies
       WHERE book_id = $1 AND condition_status = 'AVAILABLE'
       ORDER BY id LIMIT 1`,
      [id],
    );
    await pool.query(
      `INSERT INTO loans (user_id, copy_id, due_at)
       VALUES ($1, $2, now() + interval '14 days')`,
      [member.id, copy.rows[0]!.id],
    );

    const after = await request(httpApp).get(
      `/api/v1/books/${id}/availability`,
    );
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual({
      bookId: id,
      availableCopies: 1,
    });
    expect(after.headers["cache-control"]).toBe("no-store");
  });

  it("rejects an invalid supplied token on public detail routes", async () => {
    for (const suffix of ["", "/availability"]) {
      const response = await request(httpApp)
        .get(`/api/v1/books/${seedBookId}${suffix}`)
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
    }
  });
});
