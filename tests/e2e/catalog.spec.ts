import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

// A separate API/database schema keeps browser mutations away from development data.
try {
  loadEnvFile(resolve(".env"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const require = createRequire(resolve("server/package.json"));
const { Pool } =
  require("pg") as typeof import("../../server/node_modules/@types/pg/index.js");
const argon2 = require("argon2") as {
  hash: (value: string) => Promise<string>;
};
let pool: InstanceType<typeof Pool>;
let processHandle: ChildProcess | undefined;
let schema: string;
let apiBase: string;
let categoryId: string;
const password = "Browser-catalog-test-password";
const email = "staff@catalog.test";
const bookPrefix = `Browser ${randomUUID().slice(0, 8)}`;

test.beforeAll(async ({ browserName }, workerInfo) => {
  void browserName;
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
    throw new Error(
      "Catalog browser tests require TEST_DATABASE_URL ending _test.",
    );
  pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  schema = `catalog_browser_${randomUUID().replaceAll("-", "")}`;
  await pool.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(databaseUrl);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const port = 3200 + workerInfo.workerIndex;
  apiBase = `http://127.0.0.1:${port}`;
  const environment = {
    ...process.env,
    DATABASE_URL: scoped.toString(),
    PORT: String(port),
    HOST: "127.0.0.1",
    JWT_SECRET: randomBytes(48).toString("hex"),
    LOG_LEVEL: "silent",
  };
  execFileSync(process.execPath, ["dist/db/migrate.js"], {
    cwd: resolve("server"),
    env: environment,
    stdio: "pipe",
  });
  const client = await pool.connect();
  try {
    await client.query(`SET search_path=${schema}`);
    await client.query(
      "INSERT INTO users(full_name,email,password_hash,role) VALUES ('Catalog Staff',$1,$2,'LIBRARIAN')",
      [email, await argon2.hash(password)],
    );
    categoryId = (
      await client.query(
        "INSERT INTO categories(name,slug) VALUES ('Browser shelf','browser-shelf') RETURNING id",
      )
    ).rows[0].id;
    for (let i = 1; i <= 13; i++)
      await client.query(
        "INSERT INTO books(category_id,isbn,title,author,description) VALUES ($1,null,$2,'Browser Author','A real test book.')",
        [categoryId, `${bookPrefix} ${String(i).padStart(2, "0")}`],
      );
  } finally {
    client.release();
  }
  processHandle = spawn(process.execPath, ["dist/server.js"], {
    cwd: resolve("server"),
    env: environment,
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${apiBase}/health/ready`)).ok) return;
    } catch {
      /* startup in progress */
    }
    if (processHandle.exitCode !== null)
      throw new Error("Catalog test API exited during startup.");
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Catalog test API did not become ready.");
});
test.afterAll(async () => {
  if (processHandle && processHandle.exitCode === null) {
    processHandle.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      processHandle!.once("exit", () => resolve());
      setTimeout(() => {
        processHandle?.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    });
  }
  if (pool) {
    try {
      if (schema) await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await pool.end();
    }
  }
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const original = new URL(route.request().url());
    const response = await route.fetch({
      url: `${apiBase}${original.pathname}${original.search}`,
    });
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
});

test("public catalog search, pagination, details, empty and recoverable error states", async ({
  page,
}) => {
  await expect(page.getByText("13 books found")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByLabel("Search books").fill(`${bookPrefix} 01`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 books found")).toBeVisible();
  await page
    .getByRole("button", { name: `View ${bookPrefix} 01`, exact: true })
    .click();
  await expect(page.getByText("0 copies available")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add book", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search books").fill("no-such-catalog-title");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No books match your search.")).toBeVisible();
  await page.route("**/api/v1/books?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "Unavailable",
        detail: "Catalog temporarily unavailable.",
        status: 503,
        requestId: "catalog-browser-error",
      }),
    }),
  );
  await page.getByLabel("Search books").fill(bookPrefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Catalog temporarily unavailable.",
  );
  await page.unroute("**/api/v1/books?**");
  await page.getByRole("button", { name: "Retry books" }).click();
  await expect(page.getByText("13 books found")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("staff manages categories, books and copies with conflict recovery", async ({
  page,
}) => {
  await page.getByText("Staff sign in to manage the catalog").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Catalog Staff", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("New shelf");
  await page.getByLabel("Category slug", { exact: true }).fill("new-shelf");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit New shelf", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit New shelf", exact: true })
    .click();
  await page.getByLabel("Category name", { exact: true }).fill("Updated shelf");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Updated shelf", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  const form = page.getByRole("form", { name: "Add book", exact: true });
  await form.getByLabel("Title", { exact: true }).fill("A new managed book");
  await form.getByLabel("Author", { exact: true }).fill("Catalog Writer");
  await form
    .getByLabel("Book category")
    .selectOption({ label: "Updated shelf" });
  await form
    .getByLabel("Description", { exact: true })
    .fill("Created through the real browser flow.");
  await form.getByRole("button", { name: "Create book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A new managed book", level: 3 }),
  ).toBeVisible();
  await page.getByLabel("New copy barcode").fill("BROWSER-001");
  await page.getByRole("button", { name: "Add copy", exact: true }).click();
  await expect(page.getByText("1 copies available")).toBeVisible();
  await page
    .getByLabel("Condition for BROWSER-001")
    .selectOption("MAINTENANCE");
  await expect(page.getByText("0 copies available")).toBeVisible();
  await page.getByRole("button", { name: "Edit book", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit book", exact: true });
  await edit.getByLabel("Title", { exact: true }).fill("Updated managed book");
  await edit.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated managed book", level: 3 }),
  ).toBeVisible();
  // A second staff edit makes the open form stale; the UI must surface 412.
  await page.getByRole("button", { name: "Edit book", exact: true }).click();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path=${schema}`);
    await client.query(
      "UPDATE books SET title='External edit',version=version+1 WHERE title='Updated managed book'",
    );
  } finally {
    client.release();
  }
  await page
    .getByRole("form", { name: "Edit book", exact: true })
    .getByRole("button", { name: "Save book", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "The book has changed. Reload it before saving.",
  );
  await page.getByRole("button", { name: "Reload book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "External edit", level: 3 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive book", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(
    page.getByLabel("Book details").getByText("Archived", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated shelf", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByLabel("Manage categories").getByRole("alert"),
  ).toContainText("This category is referenced by a book");
  await page
    .getByRole("button", { name: "Keep category", exact: true })
    .click();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Temporary shelf");
  await page
    .getByLabel("Category slug", { exact: true })
    .fill("temporary-shelf");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Temporary shelf", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Temporary shelf", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add book", exact: true }),
  ).toHaveCount(0);
});
