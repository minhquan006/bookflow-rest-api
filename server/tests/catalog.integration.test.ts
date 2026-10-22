import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { runMigrations } from "../src/db/migrate.js";
import { createCatalogRouter } from "../src/modules/catalog/controller.js";
import { createCatalogService } from "../src/modules/catalog/service.js";
import { createLogger } from "../src/shared/logger.js";
import { createAccessTokens } from "../src/shared/tokens.js";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("A dedicated TEST_DATABASE_URL ending _test is required.");
const schema = `catalog_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 5000,
});
const pool = new Pool({
  connectionString: url,
  options: `-c search_path=${schema}`,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "catalog-test-signing-secret-with-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const app = createApp({
  config,
  logger: createLogger(config),
  checkReadiness: async () => true,
  apiRouter: createCatalogRouter(config, pool),
  rateLimit: 5000,
});
const ids = {
  librarian: randomUUID(),
  member: randomUUID(),
  admin: randomUUID(),
};
const tokens: Record<string, string> = {};
const categoryBody = () => ({
  name: `Category ${randomUUID()}`,
  slug: `cat-${randomUUID()}`,
});
async function category() {
  const r = await request(app)
    .post("/api/v1/categories")
    .auth(tokens.librarian!, { type: "bearer" })
    .send(categoryBody());
  expect(r.status).toBe(201);
  return r.body.data;
}
async function book(overrides = {}) {
  const cat = await category();
  const r = await request(app)
    .post("/api/v1/books")
    .auth(tokens.librarian!, { type: "bearer" })
    .send({
      categoryId: cat.id,
      isbn: null,
      title: `Book ${randomUUID()}`,
      author: "Test Author",
      description: "Description",
      ...overrides,
    });
  expect(r.status).toBe(201);
  return { value: r.body.data, etag: r.headers.etag as string };
}
async function copy(bookId: string) {
  const r = await request(app)
    .post(`/api/v1/books/${bookId}/copies`)
    .auth(tokens.librarian!, { type: "bearer" })
    .send({ barcode: randomUUID() });
  expect(r.status).toBe(201);
  return r.body.data;
}
async function loan(copyId: string) {
  return (
    await pool.query(
      "INSERT INTO loans (user_id,copy_id,due_at) VALUES ($1,$2,now()+interval '14 days') RETURNING id",
      [ids.member, copyId],
    )
  ).rows[0].id;
}
async function waitForBlockedQuery(pattern: string) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
      [pattern],
    );
    if (result.rowCount) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(
    "Expected catalog mutation to wait for the concurrent transaction lock.",
  );
}
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool);
  for (const [role, id] of Object.entries(ids)) {
    await pool.query(
      "INSERT INTO users (id, full_name,email,password_hash,role) VALUES ($1,'Test User',$2,'unused',$3)",
      [id, `${id}@bookflow.test`, role.toUpperCase()],
    );
    tokens[role] = await createAccessTokens(config).sign(id);
  }
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

describe("Catalog HTTP with PostgreSQL", () => {
  it("creates, paginates, replaces and deletes categories with atomic audit", async () => {
    const body = categoryBody();
    const created = await request(app)
      .post("/api/v1/categories")
      .auth(tokens.admin!, { type: "bearer" })
      .send({ ...body, name: ` ${body.name} ` });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.headers.location).toBe(`/api/v1/categories/${id}`);
    expect(created.body.data.name).toBe(body.name);
    const page = await request(app).get("/api/v1/categories?limit=1&page=1");
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination).toMatchObject({ page: 1, limit: 1 });
    const updated = await request(app)
      .put(`/api/v1/categories/${id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ ...body, name: "Changed " + body.name });
    expect(updated.status).toBe(200);
    const deleted = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .auth(tokens.librarian!, { type: "bearer" });
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    expect(
      (
        await pool.query(
          "SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY occurred_at",
          [id],
        )
      ).rows.map((r) => r.action),
    ).toEqual(["category.created", "category.updated", "category.deleted"]);
  });
  it("rejects case-insensitive duplicate category names and duplicate slugs", async () => {
    const cat = await category();
    for (const body of [
      { ...categoryBody(), name: cat.name.toUpperCase() },
      { ...categoryBody(), slug: cat.slug },
    ]) {
      const r = await request(app)
        .post("/api/v1/categories")
        .auth(tokens.librarian!, { type: "bearer" })
        .send(body);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("CATEGORY_ALREADY_EXISTS");
    }
  });
  it.each([
    ["post", "/categories"],
    ["put", `/categories/${randomUUID()}`],
    ["delete", `/categories/${randomUUID()}`],
    ["post", "/books"],
    ["put", `/books/${randomUUID()}`],
    ["patch", `/books/${randomUUID()}`],
    ["delete", `/books/${randomUUID()}`],
    ["get", `/books/${randomUUID()}/copies`],
    ["post", `/books/${randomUUID()}/copies`],
    ["patch", `/copies/${randomUUID()}`],
  ] as const)(
    "protects %s %s from guests and members",
    async (method, path) => {
      expect(
        (await request(app)[method](`/api/v1${path}`).send({})).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            [method](`/api/v1${path}`)
            .auth(tokens.member!, { type: "bearer" })
            .send({})
        ).status,
      ).toBe(403);
    },
  );
  it("validates pagination, filters, IDs, category names, slug and book input", async () => {
    for (const path of [
      "/categories?page=0",
      "/books?limit=101",
      "/books?sort=title;DROP TABLE users",
      "/books?includeArchived=1",
      "/books?categoryId=invalid",
      "/books?extra=1",
      "/books/invalid",
    ])
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(400);
    for (const body of [
      { name: " ", slug: "test" },
      { name: "Test", slug: "UPPER" },
      { ...categoryBody(), role: "ADMIN" },
    ])
      expect(
        (
          await request(app)
            .post("/api/v1/categories")
            .auth(tokens.librarian!, { type: "bearer" })
            .send(body)
        ).status,
      ).toBe(400);
    const cat = await category();
    const base = {
      categoryId: cat.id,
      isbn: null,
      title: "Test",
      author: "Author",
      description: "",
    };
    for (const change of [
      { title: " " },
      { isbn: "invalid" },
      { description: "x".repeat(5001) },
      { archivedAt: new Date().toISOString() },
    ])
      expect(
        (
          await request(app)
            .post("/api/v1/books")
            .auth(tokens.librarian!, { type: "bearer" })
            .send({ ...base, ...change })
        ).status,
      ).toBe(400);
    const missing = await request(app)
      .post("/api/v1/books")
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ ...base, categoryId: randomUUID() });
    expect(missing.status).toBe(409);
    expect(missing.body.code).toBe("CATEGORY_NOT_FOUND");
  });
  it("searches title, author, ISBN, filters categories, paginates and sorts deterministically", async () => {
    const cat = await category();
    const prefix = randomUUID();
    for (const title of ["Beta", "Alpha", "Alpha"])
      await request(app)
        .post("/api/v1/books")
        .auth(tokens.librarian!, { type: "bearer" })
        .send({
          categoryId: cat.id,
          isbn: null,
          title: `${prefix} ${title}`,
          author: "Search Writer",
          description: "",
        })
        .expect(201);
    const first = await request(app).get(
      `/api/v1/books?categoryId=${cat.id}&q=${prefix}&limit=2`,
    );
    const second = await request(app).get(
      `/api/v1/books?categoryId=${cat.id}&q=${prefix}&limit=2&page=2`,
    );
    expect(first.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(
      new Set([...first.body.data, ...second.body.data].map((b) => b.id)).size,
    ).toBe(3);
    expect(first.body.data.map((b: { id: string }) => b.id)).toEqual(
      first.body.data.map((b: { id: string }) => b.id).sort(),
    );
    expect(second.body.data[0].title).toContain("Beta");
    expect(
      (await request(app).get(`/api/v1/books?categoryId=${cat.id}&sort=-title`))
        .body.data[0].title,
    ).toContain("Beta");
    expect(
      (
        await request(app).get(
          `/api/v1/books?categoryId=${cat.id}&q=Search%20Writer`,
        )
      ).body.pagination.total,
    ).toBe(3);
    const isbn = "9781234567890";
    await book({ isbn });
    expect(
      (await request(app).get(`/api/v1/books?q=${isbn}`)).body.data[0].isbn,
    ).toBe(isbn);
    const injection = await request(app)
      .get("/api/v1/books")
      .query({ q: "%' OR 1=1 --" });
    expect(injection.status).toBe(200);
    expect(injection.body.data).toEqual([]);
  });
  it("returns ETags, conditional GET, enforces If-Match, replaces and patches metadata", async () => {
    const { value, etag } = await book();
    expect(etag).toBe(`"book-${value.id}-v1"`);
    const same = await request(app)
      .get(`/api/v1/books/${value.id}`)
      .set("If-None-Match", etag);
    expect(same.status).toBe(304);
    expect(same.text).toBe("");
    expect(
      (
        await request(app)
          .patch(`/api/v1/books/${value.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .send({ title: "Changed" })
      ).status,
    ).toBe(428);
    for (const tag of ["*", `W/${etag}`, '"wrong"'])
      expect(
        (
          await request(app)
            .patch(`/api/v1/books/${value.id}`)
            .auth(tokens.librarian!, { type: "bearer" })
            .set("If-Match", tag)
            .send({ title: "Changed" })
        ).status,
      ).toBe(412);
    expect(
      (
        await request(app)
          .patch(`/api/v1/books/${value.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .set("If-Match", etag)
          .send({})
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put(`/api/v1/books/${value.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .set("If-Match", etag)
          .send({ title: "Incomplete" })
      ).status,
    ).toBe(400);
    const changed = await request(app)
      .patch(`/api/v1/books/${value.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .set("If-Match", etag)
      .send({ title: " Changed " });
    expect(changed.status).toBe(200);
    expect(changed.body.data.title).toBe("Changed");
    expect(changed.body.data.version).toBe(2);
    expect(
      (
        await request(app)
          .patch(`/api/v1/books/${value.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .set("If-Match", etag)
          .send({ title: "Stale" })
      ).status,
    ).toBe(412);
    const replacement = {
      categoryId: value.categoryId,
      isbn: null,
      title: "Replaced",
      author: "Author",
      description: "New",
    };
    const replaced = await request(app)
      .put(`/api/v1/books/${value.id}`)
      .auth(tokens.admin!, { type: "bearer" })
      .set("If-Match", changed.headers.etag)
      .send(replacement);
    expect(replaced.status).toBe(200);
    expect(replaced.body.data).toMatchObject({ ...replacement, version: 3 });
  });
  it("allows one concurrent write with the same ETag and audits only the winner", async () => {
    const { value, etag } = await book();
    const responses = await Promise.all(
      ["First", "Second"].map((title) =>
        request(app)
          .patch(`/api/v1/books/${value.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .set("If-Match", etag)
          .send({ title }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 412]);
    expect(
      (
        await pool.query(
          "SELECT id FROM audit_logs WHERE entity_id=$1 AND action='book.updated'",
          [value.id],
        )
      ).rowCount,
    ).toBe(1);
  });
  it("rejects duplicate ISBNs without corrupting the original book", async () => {
    const isbn = "123456789X";
    await book({ isbn });
    const cat = await category();
    const r = await request(app)
      .post("/api/v1/books")
      .auth(tokens.librarian!, { type: "bearer" })
      .send({
        categoryId: cat.id,
        isbn,
        title: "Duplicate",
        author: "Author",
        description: "",
      });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("ISBN_ALREADY_EXISTS");
  });
  it("archives metadata, hides it before 304 evaluation and retains category/history", async () => {
    const { value, etag } = await book();
    const c = await copy(value.id);
    await request(app)
      .delete(`/api/v1/books/${value.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .set("If-Match", etag)
      .expect(204);
    expect(
      (
        await request(app)
          .get(`/api/v1/books/${value.id}`)
          .set("If-None-Match", "*")
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/books/${value.id}/availability`)).status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/v1/books?includeArchived=true")).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/v1/books?includeArchived=true")
          .auth(tokens.member!, { type: "bearer" })
      ).status,
    ).toBe(403);
    const staff = await request(app)
      .get(`/api/v1/books/${value.id}`)
      .auth(tokens.librarian!, { type: "bearer" });
    expect(staff.status).toBe(200);
    expect(staff.body.data.archivedAt).not.toBeNull();
    const list = await request(app)
      .get(`/api/v1/books?categoryId=${value.categoryId}&includeArchived=true`)
      .auth(tokens.librarian!, { type: "bearer" });
    expect(list.body.data[0].id).toBe(value.id);
    expect(
      (await request(app).get(`/api/v1/books?categoryId=${value.categoryId}`))
        .body.data,
    ).toEqual([]);
    const blocked = await request(app)
      .delete(`/api/v1/categories/${value.categoryId}`)
      .auth(tokens.librarian!, { type: "bearer" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CATEGORY_IN_USE");
    expect(
      (await pool.query("SELECT id FROM book_copies WHERE id=$1", [c.id]))
        .rowCount,
    ).toBe(1);
    expect(
      (
        await request(app)
          .post(`/api/v1/books/${value.id}/copies`)
          .auth(tokens.librarian!, { type: "bearer" })
          .send({ barcode: randomUUID() })
      ).status,
    ).toBe(409);
  });
  it("manages copies, rejects duplicate barcodes and calculates availability without metadata caching", async () => {
    const { value } = await book();
    const a = await copy(value.id);
    const b = await copy(value.id);
    const c = await copy(value.id);
    const duplicate = await request(app)
      .post(`/api/v1/books/${value.id}/copies`)
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ barcode: a.barcode });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("BARCODE_ALREADY_EXISTS");
    await request(app)
      .patch(`/api/v1/copies/${a.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ conditionStatus: "MAINTENANCE" })
      .expect(200);
    await loan(b.id);
    const avail = await request(app).get(
      `/api/v1/books/${value.id}/availability`,
    );
    expect(avail.status).toBe(200);
    expect(avail.body.data).toEqual({ bookId: value.id, availableCopies: 1 });
    expect(avail.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await request(app)
          .get(`/api/v1/books/${value.id}/availability`)
          .set("If-None-Match", "*")
      ).status,
    ).toBe(200);
    const copies = await request(app)
      .get(`/api/v1/books/${value.id}/copies?limit=2`)
      .auth(tokens.librarian!, { type: "bearer" });
    expect(copies.body.pagination.total).toBe(3);
    expect(copies.body.data).toHaveLength(2);
    const blocked = await request(app)
      .patch(`/api/v1/copies/${b.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ conditionStatus: "RETIRED" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("COPY_HAS_ACTIVE_LOAN");
    await request(app)
      .patch(`/api/v1/copies/${c.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .send({ conditionStatus: "RETIRED" })
      .expect(200);
    expect(
      (await request(app).get(`/api/v1/books/${value.id}/availability`)).body
        .data.availableCopies,
    ).toBe(0);
    expect(
      (
        await request(app)
          .patch(`/api/v1/copies/${c.id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .send({ conditionStatus: "INVALID" })
      ).status,
    ).toBe(400);
  });
  it("blocks archive while any copy has an open loan", async () => {
    const { value, etag } = await book();
    const c = await copy(value.id);
    await loan(c.id);
    const response = await request(app)
      .delete(`/api/v1/books/${value.id}`)
      .auth(tokens.librarian!, { type: "bearer" })
      .set("If-Match", etag);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("BOOK_HAS_ACTIVE_LOANS");
    expect(
      (
        await pool.query("SELECT archived_at FROM books WHERE id=$1", [
          value.id,
        ])
      ).rows[0].archived_at,
    ).toBeNull();
  });
  it("returns 404 for missing category/book/copy resources and rejects disabled tokens", async () => {
    const id = randomUUID();
    for (const path of [`/books/${id}`, `/books/${id}/availability`])
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(404);
    expect(
      (
        await request(app)
          .put(`/api/v1/categories/${id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .send(categoryBody())
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/copies/${id}`)
          .auth(tokens.librarian!, { type: "bearer" })
          .send({ conditionStatus: "AVAILABLE" })
      ).status,
    ).toBe(404);
    await pool.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
      ids.admin,
    ]);
    try {
      expect(
        (
          await request(app)
            .get("/api/v1/books?includeArchived=true")
            .auth(tokens.admin!, { type: "bearer" })
        ).status,
      ).toBe(401);
    } finally {
      await pool.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
        ids.admin,
      ]);
    }
  });
  it("serializes archive with a concurrent borrower holding the book lock", async () => {
    const { value, etag } = await book();
    const c = await copy(value.id);
    const borrower = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await borrower.query("BEGIN");
      await borrower.query("SELECT id FROM books WHERE id=$1 FOR UPDATE", [
        value.id,
      ]);
      pending = request(app)
        .delete(`/api/v1/books/${value.id}`)
        .auth(tokens.librarian!, { type: "bearer" })
        .set("If-Match", etag)
        .then((r) => r);
      await waitForBlockedQuery("%FROM books WHERE id=$1 FOR UPDATE%");
      await borrower.query(
        "SELECT id FROM book_copies WHERE id=$1 FOR UPDATE",
        [c.id],
      );
      await borrower.query(
        "INSERT INTO loans (user_id,copy_id,due_at) VALUES ($1,$2,now()+interval '14 days')",
        [ids.member, c.id],
      );
      await borrower.query("COMMIT");
      const response = await pending;
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("BOOK_HAS_ACTIVE_LOANS");
    } finally {
      await borrower.query("ROLLBACK");
      borrower.release();
      if (pending) await pending;
    }
  });
  it("serializes copy condition changes with a concurrent borrower holding the copy lock", async () => {
    const { value } = await book();
    const c = await copy(value.id);
    const borrower = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await borrower.query("BEGIN");
      await borrower.query(
        "SELECT id FROM book_copies WHERE id=$1 FOR UPDATE",
        [c.id],
      );
      pending = request(app)
        .patch(`/api/v1/copies/${c.id}`)
        .auth(tokens.librarian!, { type: "bearer" })
        .send({ conditionStatus: "RETIRED" })
        .then((r) => r);
      await waitForBlockedQuery("%FROM book_copies WHERE id=$1 FOR UPDATE%");
      await borrower.query(
        "INSERT INTO loans (user_id,copy_id,due_at) VALUES ($1,$2,now()+interval '14 days')",
        [ids.member, c.id],
      );
      await borrower.query("COMMIT");
      const response = await pending;
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("COPY_HAS_ACTIVE_LOAN");
      expect(
        (
          await pool.query(
            "SELECT condition_status FROM book_copies WHERE id=$1",
            [c.id],
          )
        ).rows[0].condition_status,
      ).toBe("AVAILABLE");
    } finally {
      await borrower.query("ROLLBACK");
      borrower.release();
      if (pending) await pending;
    }
  });
  it("rolls back catalog changes if the audit fails", async () => {
    const body = categoryBody();
    await expect(
      createCatalogService(pool).createCategory(body, {
        id: ids.librarian,
        role: "LIBRARIAN",
        requestId: "",
      }),
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      (await pool.query("SELECT id FROM categories WHERE slug=$1", [body.slug]))
        .rowCount,
    ).toBe(0);
  });
});
