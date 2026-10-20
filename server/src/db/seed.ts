import "dotenv/config";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import argon2 from "argon2";
import type { Pool } from "pg";
import { createPool, withTransaction } from "./pool.js";

export const DEMO_ACCOUNTS = [
  {
    fullName: "Demo Administrator",
    email: "admin@bookflow.test",
    role: "ADMIN",
  },
  {
    fullName: "Demo Librarian",
    email: "librarian@bookflow.test",
    role: "LIBRARIAN",
  },
  { fullName: "Demo Member", email: "member@bookflow.test", role: "MEMBER" },
] as const;

export async function seedDemo(
  pool: Pool,
  options: { nodeEnv: string; password: string | undefined },
): Promise<void> {
  if (!["development", "test"].includes(options.nodeEnv)) {
    throw new Error("Demo seeding is only allowed in development or test.");
  }
  if (
    !options.password ||
    options.password.length < 12 ||
    options.password.length > 128
  ) {
    throw new Error(
      "Set SEED_DEMO_PASSWORD to a local-only password of 12–128 characters.",
    );
  }
  const passwordHash = await argon2.hash(options.password, {
    type: argon2.argon2id,
  });
  await withTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(726194034)");
    for (const account of DEMO_ACCOUNTS) {
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
        [account.fullName, account.email, passwordHash, account.role],
      );
    }
    const catalogs = [
      {
        name: "Technology",
        slug: "technology",
        title: "Practical Web Foundations",
        author: "BookFlow Demo Team",
        barcode: "DEMO-WEB",
      },
      {
        name: "Fiction",
        slug: "fiction",
        title: "The Library at Dawn",
        author: "Alex Example",
        barcode: "DEMO-DAWN",
      },
      {
        name: "Technology",
        slug: "technology",
        title: "Transactions Made Clear",
        author: "Sam Example",
        barcode: "DEMO-SQL",
      },
    ];
    for (const [index, item] of catalogs.entries()) {
      await client.query(
        "INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [item.name, item.slug],
      );
      const { rows: categories } = await client.query<{ id: string }>(
        "SELECT id FROM categories WHERE slug = $1",
        [item.slug],
      );
      if (!categories[0])
        throw new Error(
          "Demo category conflicts with existing data; seed rolled back.",
        );
      const bookId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      await client.query(
        `INSERT INTO books (id, category_id, title, author, description)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [
          bookId,
          categories[0].id,
          item.title,
          item.author,
          "Synthetic local demonstration data.",
        ],
      );
      for (let copy = 1; copy <= 2; copy++) {
        await client.query(
          `INSERT INTO book_copies (id, book_id, barcode) VALUES ($1, $2, $3)
           ON CONFLICT (barcode) DO NOTHING`,
          [randomUUID(), bookId, `${item.barcode}-${copy}`],
        );
      }
    }
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for seed.");
  const pool = createPool(process.env.DATABASE_URL);
  try {
    await seedDemo(pool, {
      nodeEnv: process.env.NODE_ENV ?? "development",
      password: process.env.SEED_DEMO_PASSWORD,
    });
    console.log(
      "Demo data seeded. Existing accounts and passwords were preserved.",
    );
    console.log(
      "Accounts: admin@bookflow.test, librarian@bookflow.test, member@bookflow.test",
    );
  } catch {
    console.error(
      "Demo seed failed. Use a migrated development/test database and SEED_DEMO_PASSWORD of 12–128 characters.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
