import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { createPool, withTransaction } from "./pool.js";

export const CURRENT_SCHEMA_VERSION = "001_initial";
const migrationsDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);

export async function hasCurrentSchema(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ ready: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1) AS ready",
    [CURRENT_SCHEMA_VERSION],
  );
  return result.rows[0]?.ready === true;
}

/** A single transaction and advisory lock prevent concurrent or partial migrations. */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  if (files.length === 0) throw new Error("No SQL migrations found.");
  const migrations = await Promise.all(
    files.map(async (name) => {
      const sql = await readFile(resolve(migrationsDirectory, name), "utf8");
      return {
        version: name.slice(0, -4),
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );

  return withTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(726194033)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ version: string; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version",
    );
    const available = new Set(migrations.map((migration) => migration.version));
    for (const row of rows) {
      if (!available.has(row.version)) {
        throw new Error(
          `Applied migration ${row.version} is missing from this checkout.`,
        );
      }
    }
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));
    const completed: string[] = [];
    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.version);
      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.version} was modified after application. Add a new migration instead.`,
          );
        }
        continue;
      }
      if (rows.some((row) => row.version > migration.version)) {
        throw new Error(
          `Migration ${migration.version} is older than an already applied migration.`,
        );
      }
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [migration.version, migration.checksum],
      );
      completed.push(migration.version);
    }
    return completed;
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for migrations.");
  const pool = createPool(databaseUrl);
  try {
    const applied = await runMigrations(pool);
    console.log(
      applied.length
        ? `Applied: ${applied.join(", ")}`
        : "Database schema is up to date.",
    );
  } catch {
    console.error(
      "Migration failed. Check database connectivity and migration consistency; no migration changes were committed.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
