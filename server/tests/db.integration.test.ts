import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasCurrentSchema, runMigrations } from "../src/db/migrate.js";
import { withTransaction } from "../src/db/pool.js";
import { seedDemo } from "../src/db/seed.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "TEST_DATABASE_URL is required; integration tests never fall back to DATABASE_URL.",
  );
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!databaseName.endsWith("_test")) {
  throw new Error(
    "TEST_DATABASE_URL must select a dedicated database ending in _test.",
  );
}

const schema = `bookflow_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
});
const pool = new Pool({
  connectionString: databaseUrl,
  options: `-c search_path=${schema}`,
  max: 5,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});
const password = "Local-only-test-password-2026";
let memberId: string;
let copyId: string;

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
});

afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

describe("PostgreSQL foundation", () => {
  it("serializes concurrent migrations of an empty schema and records checksums only once", async () => {
    const concurrent = await Promise.all([
      runMigrations(pool),
      runMigrations(pool),
    ]);
    expect(concurrent.flat()).toEqual(["001_initial"]);
    expect(await runMigrations(pool)).toEqual([]);
    expect(await hasCurrentSchema(pool)).toBe(true);
    const result = await pool.query("SELECT checksum FROM schema_migrations");
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects drift in an already applied migration", async () => {
    const original = await pool.query(
      "SELECT checksum FROM schema_migrations WHERE version = '001_initial'",
    );
    await pool.query("UPDATE schema_migrations SET checksum = $1", [
      "0".repeat(64),
    ]);
    try {
      await expect(runMigrations(pool)).rejects.toThrow(
        "modified after application",
      );
    } finally {
      await pool.query("UPDATE schema_migrations SET checksum = $1", [
        original.rows[0].checksum,
      ]);
    }
  });

  it("seeds synthetic accounts and catalog idempotently without replacing passwords", async () => {
    await seedDemo(pool, { nodeEnv: "test", password });
    const initial = await pool.query(
      "SELECT email, password_hash, role FROM users ORDER BY email",
    );
    expect(initial.rows.map((row) => row.role).sort()).toEqual([
      "ADMIN",
      "LIBRARIAN",
      "MEMBER",
    ]);
    expect(await argon2.verify(initial.rows[0].password_hash, password)).toBe(
      true,
    );
    await seedDemo(pool, {
      nodeEnv: "test",
      password: "Different-local-password-2026",
    });
    const repeated = await pool.query(
      "SELECT email, password_hash, role FROM users ORDER BY email",
    );
    expect(repeated.rows).toEqual(initial.rows);
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM books) AS books,
      (SELECT count(*)::int FROM book_copies) AS copies`);
    expect(counts.rows[0]).toEqual({
      users: 3,
      categories: 2,
      books: 3,
      copies: 6,
    });
    memberId = (await pool.query("SELECT id FROM users WHERE role = 'MEMBER'"))
      .rows[0].id;
    copyId = (
      await pool.query("SELECT id FROM book_copies ORDER BY barcode LIMIT 1")
    ).rows[0].id;
  });

  it("refuses demo seed in production and without a sufficiently long password", async () => {
    await expect(
      seedDemo(pool, { nodeEnv: "production", password }),
    ).rejects.toThrow("only allowed");
    await expect(
      seedDemo(pool, { nodeEnv: "test", password: undefined }),
    ).rejects.toThrow("SEED_DEMO_PASSWORD");
  });

  it("rolls back both loan and audit when the service fails, then releases the client", async () => {
    const loanId = randomUUID();
    await expect(
      withTransaction(pool, async (client) => {
        await client.query(
          "INSERT INTO loans (id, user_id, copy_id, due_at) VALUES ($1, $2, $3, now() + interval '14 days')",
          [loanId, memberId, copyId],
        );
        await client.query(
          "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, request_id) VALUES ($1, 'loan.created', 'loan', $2, $3)",
          [memberId, loanId, randomUUID()],
        );
        throw new Error("Injected service failure");
      }),
    ).rejects.toThrow("Injected service failure");
    expect(
      (await pool.query("SELECT id FROM loans WHERE id = $1", [loanId]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query("SELECT id FROM audit_logs WHERE entity_id = $1", [
          loanId,
        ])
      ).rowCount,
    ).toBe(0);
    expect((await pool.query("SELECT 1 AS healthy")).rows[0].healthy).toBe(1);
  });

  it("allows exactly one open loan when two independent connections compete for a copy", async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    const sql =
      "INSERT INTO loans (user_id, copy_id, due_at) VALUES ($1, $2, now() + interval '14 days') RETURNING id";
    try {
      const results = await Promise.allSettled([
        first.query(sql, [memberId, copyId]),
        second.query(sql, [memberId, copyId]),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
        "23505",
      );
      expect(
        (
          await pool.query(
            "SELECT id FROM loans WHERE copy_id = $1 AND returned_at IS NULL",
            [copyId],
          )
        ).rowCount,
      ).toBe(1);
    } finally {
      first.release();
      second.release();
    }
  });

  it("rejects invalid loan dates and incomplete return confirmation", async () => {
    const unusedCopy = (
      await pool.query("SELECT id FROM book_copies WHERE id <> $1 LIMIT 1", [
        copyId,
      ])
    ).rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO loans (user_id, copy_id, borrowed_at, due_at) VALUES ($1, $2, now(), now() - interval '1 day')",
        [memberId, unusedCopy],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "loans_due_after_borrow",
    });
    await expect(
      pool.query("UPDATE loans SET returned_at = now() WHERE copy_id = $1", [
        copyId,
      ]),
    ).rejects.toMatchObject({ code: "23514", constraint: "loans_return_pair" });
  });

  it("preserves foreign-key history and normalizes account/category uniqueness", async () => {
    await expect(
      pool.query("DELETE FROM users WHERE id = $1", [memberId]),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        "INSERT INTO users (full_name, email, password_hash) VALUES ('Example', 'MEMBER@bookflow.test', 'not-used')",
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query(
        "INSERT INTO categories (name, slug) VALUES ('TECHNOLOGY', 'duplicate-tech')",
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
