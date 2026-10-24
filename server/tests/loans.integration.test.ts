import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { runMigrations } from "../src/db/migrate.js";
import { createLogger } from "../src/shared/logger.js";
import { createAccessTokens } from "../src/shared/tokens.js";
import {
  createLoansRouter,
  createLoansService,
} from "../src/modules/loans/index.js";
import { createAdministrationRouter } from "../src/modules/administration/index.js";
import { bookETag, createCatalogRouter } from "../src/modules/catalog/index.js";
import type { Principal, Role } from "../src/middleware/context.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error(
    "Loan integration tests require a dedicated TEST_DATABASE_URL ending _test.",
  );
}
const schema = `loans_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});
const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  JWT_SECRET: "loans-test-signing-key-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const router = Router();
router.use(createCatalogRouter({ pool, config }));
router.use(createLoansRouter({ pool, config }));
router.use(createAdministrationRouter({ pool, config }));
const app = createApp({
  config,
  logger: createLogger(config),
  checkReadiness: async () => true,
  apiRouter: router,
  rateLimit: 10000,
});
const tokens = createAccessTokens(config);
const service = createLoansService(pool, config);
let members: Principal[];
let staff: Principal;
let administrator: Principal;
let books: string[];
let authorization: Record<string, string>;

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool);
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE audit_logs,loans,book_copies,books,categories,refresh_tokens,users CASCADE",
  );
  members = [];
  authorization = {};
  for (const [index, role] of [
    "MEMBER",
    "MEMBER",
    "MEMBER",
    "LIBRARIAN",
    "ADMIN",
  ].entries()) {
    const principal = { id: randomUUID(), role: role as Role };
    await pool.query(
      "INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,$2,$3,'test-only-hash',$4)",
      [principal.id, `Test User ${index}`, `loan-${index}@bookflow.test`, role],
    );
    authorization[principal.id] = `Bearer ${await tokens.sign(principal.id)}`;
    if (role === "MEMBER") members.push(principal);
    if (role === "LIBRARIAN") staff = principal;
    if (role === "ADMIN") administrator = principal;
  }
  const categoryId = randomUUID();
  await pool.query(
    "INSERT INTO categories(id,name,slug) VALUES($1,'Test Books','test-books')",
    [categoryId],
  );
  books = [];
  for (let index = 0; index < 8; index++) {
    const id = randomUUID();
    books.push(id);
    await pool.query(
      "INSERT INTO books(id,category_id,title,author) VALUES($1,$2,$3,'Test Author')",
      [id, categoryId, `Book ${index}`],
    );
    for (let copy = 0; copy < 2; copy++)
      await pool.query(
        "INSERT INTO book_copies(book_id,barcode) VALUES($1,$2)",
        [id, `BOOK-${index}-${copy}`],
      );
  }
});
const borrow = (bookId = books[0]!, member = members[0]!) =>
  request(app)
    .post("/api/v1/loans")
    .set("Authorization", authorization[member.id]!)
    .send({ bookId });
const returnLoan = (id: string, actor = staff) =>
  request(app)
    .put(`/api/v1/loans/${id}/return`)
    .set("Authorization", authorization[actor.id]!)
    .send({});
async function borrowDirect(bookId: string, member = members[0]!) {
  return service.borrow(member, bookId, randomUUID());
}

describe("Loans HTTP integration", () => {
  it("borrows an available copy with the exact DTO, Location, fourteen-day duration and matching audit", async () => {
    const response = await borrow();
    expect(response.status).toBe(201);
    const loan = response.body.data;
    expect(Object.keys(loan).sort()).toEqual(
      [
        "id",
        "userId",
        "bookId",
        "copyId",
        "borrowedAt",
        "dueAt",
        "returnedAt",
        "returnedBy",
      ].sort(),
    );
    expect(loan.userId).toBe(members[0]!.id);
    expect(loan.bookId).toBe(books[0]);
    expect(loan.returnedAt).toBeNull();
    expect(loan.returnedBy).toBeNull();
    expect(Date.parse(loan.dueAt) - Date.parse(loan.borrowedAt)).toBe(
      14 * 24 * 60 * 60 * 1000,
    );
    expect(response.headers.location).toBe(`/api/v1/loans/${loan.id}`);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await pool.query(
          "SELECT actor_id,request_id,action FROM audit_logs WHERE entity_id=$1",
          [loan.id],
        )
      ).rows,
    ).toEqual([
      {
        actor_id: members[0]!.id,
        request_id: response.headers["x-request-id"],
        action: "loan.created",
      },
    ]);
  });
  it("rejects anonymous/staff borrowing and strict body mass assignment", async () => {
    expect(
      (await request(app).post("/api/v1/loans").send({ bookId: books[0] }))
        .status,
    ).toBe(401);
    expect((await borrow(books[0], staff)).status).toBe(403);
    expect((await borrow(books[0], administrator)).status).toBe(403);
    const assigned = await request(app)
      .post("/api/v1/loans")
      .set("Authorization", authorization[members[0]!.id]!)
      .send({ bookId: books[0], userId: members[1]!.id });
    expect(assigned.status).toBe(400);
    expect(
      (await pool.query("SELECT count(*)::int AS total FROM loans")).rows[0]
        .total,
    ).toBe(0);
  });
  it("rechecks borrower role/status in a transaction and rejects an archived or missing book", async () => {
    await pool.query("UPDATE books SET archived_at=now() WHERE id=$1", [
      books[0],
    ]);
    expect((await borrow()).status).toBe(404);
    expect((await borrow(randomUUID())).status).toBe(404);
    await pool.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
      members[0]!.id,
    ]);
    await expect(borrowDirect(books[1]!)).rejects.toMatchObject({
      status: 401,
    });
    expect((await borrow(books[1])).status).toBe(401);
  });
  it("blocks duplicate books, overdue loans and the configured active limit without side effects", async () => {
    await borrowDirect(books[0]!);
    const duplicate = await borrow();
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("ALREADY_BORROWED");
    await pool.query(
      "UPDATE loans SET borrowed_at=now()-interval '20 days',due_at=now()-interval '1 day'",
    );
    const overdue = await borrow(books[1]);
    expect(overdue.status).toBe(409);
    expect(overdue.body.code).toBe("OVERDUE_LOANS");
    await pool.query("UPDATE loans SET due_at=now()+interval '1 day'");
    await borrowDirect(books[1]!);
    await borrowDirect(books[2]!);
    const limit = await borrow(books[3]);
    expect(limit.status).toBe(409);
    expect(limit.body.code).toBe("LOAN_LIMIT_REACHED");
    expect(
      (await pool.query("SELECT count(*)::int AS total FROM loans")).rows[0]
        .total,
    ).toBe(3);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM audit_logs WHERE action='loan.created'",
        )
      ).rows[0].total,
    ).toBe(3);
  });
  it("only allocates AVAILABLE copies and returns BOOK_UNAVAILABLE when none can serve", async () => {
    await pool.query(
      "UPDATE book_copies SET condition_status='MAINTENANCE' WHERE book_id=$1",
      [books[0]],
    );
    const response = await borrow();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("BOOK_UNAVAILABLE");
    await pool.query(
      "UPDATE book_copies SET condition_status='RETIRED' WHERE book_id=$1",
      [books[0]],
    );
    expect((await borrow()).body.code).toBe("BOOK_UNAVAILABLE");
  });
  it("keeps loan ownership private and paginates/filters staff and member history", async () => {
    const first = await borrowDirect(books[0]!);
    await borrowDirect(books[1]!);
    await borrowDirect(books[2]!, members[1]);
    expect(
      (
        await request(app)
          .get(`/api/v1/loans/${first.id}`)
          .set("Authorization", authorization[members[1]!.id]!)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/loans/${first.id}`)
          .set("Authorization", authorization[staff.id]!)
      ).status,
    ).toBe(200);
    const own = await request(app)
      .get("/api/v1/loans?limit=1&page=2")
      .set("Authorization", authorization[members[0]!.id]!);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(own.body.data[0].userId).toBe(members[0]!.id);
    const all = await request(app)
      .get("/api/v1/loans")
      .set("Authorization", authorization[staff.id]!);
    expect(all.body.pagination.total).toBe(3);
    await returnLoan(first.id);
    const returned = await request(app)
      .get("/api/v1/loans?status=RETURNED")
      .set("Authorization", authorization[members[0]!.id]!);
    expect(returned.body.data.map((loan: { id: string }) => loan.id)).toEqual([
      first.id,
    ]);
    await pool.query(
      "UPDATE loans SET borrowed_at=now()-interval '20 days',due_at=now()-interval '1 day' WHERE returned_at IS NULL",
    );
    const overdue = await request(app)
      .get("/api/v1/loans?status=OVERDUE")
      .set("Authorization", authorization[staff.id]!);
    expect(overdue.body.pagination.total).toBe(2);
  });
  it("rejects invalid ID, pagination, query filters and nonempty return bodies", async () => {
    const header = authorization[staff.id]!;
    for (const path of [
      "/api/v1/loans/not-an-id",
      "/api/v1/loans?limit=101",
      "/api/v1/loans?status=LOST",
      "/api/v1/loans?userId=ignored",
      "/api/v1/loans?page=1e100",
    ]) {
      expect(
        (await request(app).get(path).set("Authorization", header)).status,
      ).toBe(400);
    }
    const loan = await borrowDirect(books[0]!);
    expect(
      (
        await request(app)
          .put(`/api/v1/loans/${loan.id}/return`)
          .set("Authorization", header)
          .send({ returnedAt: new Date().toISOString() })
      ).status,
    ).toBe(400);
  });
  it("returns a loan exactly once with fixed timestamp/staff identity, even under concurrent PUT", async () => {
    const loan = await borrowDirect(books[0]!);
    expect((await returnLoan(loan.id, members[0])).status).toBe(403);
    const [first, second] = await Promise.all([
      returnLoan(loan.id, staff),
      returnLoan(loan.id, administrator),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect([staff.id, administrator.id]).toContain(first.body.data.returnedBy);
    expect((await returnLoan(loan.id)).body).toEqual(first.body);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM audit_logs WHERE action='loan.returned' AND entity_id=$1",
          [loan.id],
        )
      ).rows[0].total,
    ).toBe(1);
    expect((await returnLoan(randomUUID())).status).toBe(404);
    const available = await pool.query(
      "SELECT c.id FROM book_copies c WHERE c.id=$1 AND NOT EXISTS(SELECT 1 FROM loans l WHERE l.copy_id=c.id AND l.returned_at IS NULL)",
      [loan.copyId],
    );
    expect(available.rowCount).toBe(1);
  });
  it("rolls back loan creation and its audit when the database rejects the audit insert", async () => {
    await pool.query(
      `CREATE FUNCTION fail_loan_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='loan.created' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      "CREATE TRIGGER fail_loan_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_loan_audit()",
    );
    try {
      const response = await borrow();
      expect(response.status).toBe(500);
      expect(response.body.code).toBe("INTERNAL_ERROR");
      expect(
        (await pool.query("SELECT count(*)::int AS total FROM loans")).rows[0]
          .total,
      ).toBe(0);
      expect(
        (await pool.query("SELECT count(*)::int AS total FROM audit_logs"))
          .rows[0].total,
      ).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER fail_loan_audit ON audit_logs");
      await pool.query("DROP FUNCTION fail_loan_audit()");
    }
    expect((await borrow()).status).toBe(201);
  });
  it("rolls back a return when its audit insert fails", async () => {
    const loan = await borrowDirect(books[0]!);
    await pool.query(
      `CREATE FUNCTION fail_return_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='loan.returned' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      "CREATE TRIGGER fail_return_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_return_audit()",
    );
    try {
      expect((await returnLoan(loan.id)).status).toBe(500);
      const row = (
        await pool.query(
          "SELECT returned_at,returned_by FROM loans WHERE id=$1",
          [loan.id],
        )
      ).rows[0];
      expect(row).toEqual({ returned_at: null, returned_by: null });
    } finally {
      await pool.query("DROP TRIGGER fail_return_audit ON audit_logs");
      await pool.query("DROP FUNCTION fail_return_audit()");
    }
    expect((await returnLoan(loan.id)).status).toBe(200);
  });
});

describe("Loans real PostgreSQL concurrency", () => {
  it("retries a rolled-back serialization failure, but bounds repeated failures", async () => {
    await pool.query("CREATE SEQUENCE loan_retry_counter");
    await pool.query(
      `CREATE FUNCTION retry_loan_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='loan.created' AND nextval('loan_retry_counter')=1 THEN RAISE EXCEPTION 'forced serialization failure' USING ERRCODE='40001'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      "CREATE TRIGGER retry_loan_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION retry_loan_audit()",
    );
    try {
      const loan = await borrowDirect(books[0]!);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS total FROM loans WHERE id=$1",
            [loan.id],
          )
        ).rows[0].total,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS total FROM audit_logs WHERE entity_id=$1",
            [loan.id],
          )
        ).rows[0].total,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "SELECT last_value::int AS attempts FROM loan_retry_counter",
          )
        ).rows[0].attempts,
      ).toBe(2);
      await pool.query(
        `CREATE OR REPLACE FUNCTION retry_loan_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('loan_retry_counter'); RAISE EXCEPTION 'persistent serialization failure' USING ERRCODE='40001'; END $$`,
      );
      await expect(borrowDirect(books[1]!)).rejects.toMatchObject({
        code: "40001",
      });
      expect(
        (
          await pool.query(
            "SELECT last_value::int AS attempts FROM loan_retry_counter",
          )
        ).rows[0].attempts,
      ).toBe(5);
      expect(
        (await pool.query("SELECT count(*)::int AS total FROM loans")).rows[0]
          .total,
      ).toBe(1);
    } finally {
      await pool.query("DROP TRIGGER retry_loan_audit ON audit_logs");
      await pool.query("DROP FUNCTION retry_loan_audit()");
      await pool.query("DROP SEQUENCE loan_retry_counter");
    }
  });
  it("allows exactly one member to obtain the last copy", async () => {
    await pool.query(
      "DELETE FROM book_copies WHERE book_id=$1 AND barcode LIKE '%-1'",
      [books[0]],
    );
    const responses = await Promise.all([
      borrow(books[0], members[0]),
      borrow(books[0], members[1]),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)!.body.code,
    ).toBe("BOOK_UNAVAILABLE");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM loans WHERE returned_at IS NULL",
        )
      ).rows[0].total,
    ).toBe(1);
  });
  it("serializes same-user borrowing so two requests cannot exceed the active limit", async () => {
    await borrowDirect(books[0]!);
    await borrowDirect(books[1]!);
    const responses = await Promise.all([borrow(books[2]), borrow(books[3])]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)!.body.code,
    ).toBe("LOAN_LIMIT_REACHED");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM loans WHERE user_id=$1 AND returned_at IS NULL",
          [members[0]!.id],
        )
      ).rows[0].total,
    ).toBe(3);
  });
  it("serializes duplicate-book borrowing for one member", async () => {
    const responses = await Promise.all([borrow(), borrow()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)!.body.code,
    ).toBe("ALREADY_BORROWED");
  });
  it("keeps archive and borrow consistent when the requests compete", async () => {
    const id = books[0]!;
    const archive = request(app)
      .delete(`/api/v1/books/${id}`)
      .set("Authorization", authorization[staff.id]!)
      .set("If-Match", bookETag(id, 1));
    const [borrowed, archived] = await Promise.all([borrow(id), archive]);
    expect([
      [201, 409],
      [404, 204],
    ]).toContainEqual([borrowed.status, archived.status]);
    const result = await pool.query(
      "SELECT archived_at,(SELECT count(*)::int FROM loans l JOIN book_copies c ON c.id=l.copy_id WHERE c.book_id=books.id AND l.returned_at IS NULL) AS open FROM books WHERE id=$1",
      [id],
    );
    expect(result.rows[0].archived_at !== null && result.rows[0].open > 0).toBe(
      false,
    );
  });
});

describe("Dashboard and audit HTTP integration", () => {
  it("enforces staff dashboard and admin audit permissions", async () => {
    expect((await request(app).get("/api/v1/dashboard")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/v1/dashboard")
          .set("Authorization", authorization[members[0]!.id]!)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/v1/audit-logs")
          .set("Authorization", authorization[staff.id]!)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/v1/audit-logs")
          .set("Authorization", authorization[members[0]!.id]!)
      ).status,
    ).toBe(403);
  });
  it("reports current aggregate counts without borrower data and refreshes after returns", async () => {
    const first = await borrowDirect(books[0]!);
    await borrowDirect(books[1]!, members[1]);
    await pool.query(
      "UPDATE loans SET borrowed_at=now()-interval '20 days',due_at=now()-interval '1 day' WHERE id=$1",
      [first.id],
    );
    await pool.query("UPDATE books SET archived_at=now() WHERE id=$1", [
      books[7],
    ]);
    await pool.query(
      "UPDATE book_copies SET condition_status='RETIRED' WHERE book_id=$1",
      [books[6]],
    );
    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", authorization[staff.id]!);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data).toMatchObject({
      activeBooks: 7,
      serviceableCopies: 14,
      activeLoans: 2,
      overdueLoans: 1,
    });
    expect(Object.keys(response.body.data).sort()).toEqual(
      [
        "activeBooks",
        "serviceableCopies",
        "activeLoans",
        "overdueLoans",
        "asOf",
      ].sort(),
    );
    expect(Number.isNaN(Date.parse(response.body.data.asOf))).toBe(false);
    await returnLoan(first.id);
    const after = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", authorization[administrator.id]!);
    expect(after.body.data).toMatchObject({ activeLoans: 1, overdueLoans: 0 });
  });
  it("filters and paginates audit with safe DTOs and rejects invalid ranges", async () => {
    const first = await borrowDirect(books[0]!);
    await borrowDirect(books[1]!, members[1]);
    await returnLoan(first.id);
    const header = authorization[administrator.id]!;
    const filtered = await request(app)
      .get(
        `/api/v1/audit-logs?action=loan.created&actorId=${members[0]!.id}&page=1&limit=1`,
      )
      .set("Authorization", header);
    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.total).toBe(1);
    expect(filtered.body.data[0]).toMatchObject({
      actorId: members[0]!.id,
      action: "loan.created",
      entityId: first.id,
      entityType: "loan",
    });
    expect(Object.keys(filtered.body.data[0]).sort()).toEqual(
      [
        "id",
        "actorId",
        "action",
        "entityType",
        "entityId",
        "requestId",
        "occurredAt",
      ].sort(),
    );
    const from = new Date(Date.now() - 60_000).toISOString(),
      to = new Date(Date.now() + 60_000).toISOString();
    const ranged = await request(app)
      .get(`/api/v1/audit-logs?from=${from}&to=${to}`)
      .set("Authorization", header);
    expect(ranged.body.pagination.total).toBe(3);
    for (const path of [
      `?from=${to}&to=${from}`,
      "?from=not-a-date",
      "?actorId=bad",
      "?limit=0",
      "?unexpected=value",
    ]) {
      expect(
        (
          await request(app)
            .get(`/api/v1/audit-logs${path}`)
            .set("Authorization", header)
        ).status,
      ).toBe(400);
    }
  });
});
