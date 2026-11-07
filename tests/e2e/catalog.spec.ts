import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("catalog searches and filters real seeded books", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();

  await page
    .getByRole("searchbox", {
      name: "Title or author",
    })
    .fill("Practical");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText("1 books found", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Practical Web Foundations",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("searchbox", {
      name: "Title or author",
    })
    .fill("The Library at Dawn");
  await page
    .getByRole("combobox", {
      name: "Category",
    })
    .selectOption({ label: "Fiction" });
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(
    page.getByRole("heading", {
      name: "The Library at Dawn",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Practical Web Foundations",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("catalog opens details and displays live API availability", async ({
  page,
  request,
}) => {
  const bookId = "10000000-0000-4000-8000-000000000001";
  const response = await request.get(`/api/v1/books/${bookId}/availability`);
  expect(response.status()).toBe(200);
  const availability = await response.json();

  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Title or author" })
    .fill("Practical Web Foundations");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  const open = page.getByRole("button", {
    name: "View details for Practical Web Foundations",
    exact: true,
  });
  await open.click();

  const details = page.locator(`#book-details-${bookId}`);
  await expect(details.getByText("ISBN", { exact: true })).toBeVisible();
  await expect(
    details.getByText("Available copies", {
      exact: true,
    }),
  ).toBeVisible();

  const count = details.locator("dd[aria-live]");
  await expect(count).toHaveText(String(availability.data.availableCopies));

  await details
    .getByRole("button", {
      name: "Refresh availability",
      exact: true,
    })
    .click();
  await expect(count).toHaveText(String(availability.data.availableCopies));

  await page
    .getByRole("button", {
      name: "Hide details for Practical Web Foundations",
      exact: true,
    })
    .click();
  await expect(details).toBeHidden();

  await page
    .getByRole("button", {
      name: "View Practical Web Foundations",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Practical Web Foundations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to borrow", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Borrow this book", exact: true }),
  ).toHaveCount(0);

  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
});

test("member can view availability and navigate to integrated Loans without automatic borrowing", async ({
  page,
}) => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password)
    throw new Error("SEED_DEMO_PASSWORD is required for seeded member login.");
  const loanRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/loans"))
      loanRequests.push(request.method());
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("member@bookflow.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Book catalog", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "My loans", exact: true }),
  ).toBeVisible();
  await page.goto("/books/10000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", {
      name: "Practical Web Foundations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/^\d+ available cop(?:y|ies)$/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Borrow this book", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Borrowing is coming soon.")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /borrow|my loans/i }),
  ).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByText("YOUR ACCOUNT", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View your loans", exact: true }),
  ).toBeVisible();
  expect(loanRequests).toEqual([]);
  await page
    .getByRole("button", { name: "View your loans", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My loans", exact: true }),
  ).toBeVisible();
});

test("catalog URL restores pagination, detail return, history, size and language", async ({
  page,
}) => {
  // Batch synthetic fixtures directly into this stack's DB: avoid dozens of
  // setup/cleanup HTTP mutations exhausting the real 300 requests/min limiter.
  const require = createRequire(
    new URL("../../server/package.json", import.meta.url),
  );
  const pool = new (require("pg").Pool)({
    connectionString: process.env.DATABASE_URL,
  });
  const prefix = `URL fixture ${randomUUID().slice(0, 8)}`;
  let books: { id: string; title: string; version: number }[] = [];
  try {
    const categories = await pool.query(
      "SELECT id FROM categories ORDER BY id LIMIT 1",
    );
    const result = await pool.query(
      `INSERT INTO books (category_id, title, author, description)
       SELECT $1, $2 || ' ' || lpad(n::text, 3, '0'), $3, $4
       FROM generate_series(1, 13) AS n RETURNING id, title, version`,
      [
        categories.rows[0].id,
        prefix,
        "Synthetic pagination fixture",
        "URL regression",
      ],
    );
    books = result.rows;
    books.sort((a, b) => a.title.localeCompare(b.title));
    const query = new URLSearchParams({
      page: "2",
      limit: "12",
      sort: "title",
      q: prefix,
    });
    await page.goto(`/books?${query}`);
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: `View ${books[12].title}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: books[12].title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to catalog", exact: true })
      .click();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("q")).toBe(prefix);
    await page.reload();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    await page.getByLabel("Title or author").fill("Unsubmitted draft");
    await page.getByLabel("Language", { exact: true }).selectOption("vi");
    await expect(page.getByLabel("Tên sách hoặc tác giả")).toHaveValue(
      "Unsubmitted draft",
    );
    await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
    await page.getByLabel("Books per page").selectOption("24");
    await expect(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("q")).toBe(prefix);
    expect(new URL(page.url()).searchParams.get("limit")).toBe("24");
    await page.getByLabel("Title or author").fill(`missing-${prefix}`);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByText("0 books found", { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("page")).toBe("1");
    await page.goto(
      `/books?page=-2&limit=2&sort=invalid&includeArchived=true&q=${encodeURIComponent(prefix)}`,
    );
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("includeArchived")).toBeNull();
    expect(new URL(page.url()).searchParams.get("limit")).toBe("12");
  } finally {
    try {
      // Delete only records created by this test; no copies/loans are created.
      await pool.query(
        "DELETE FROM books WHERE id = ANY($1::uuid[]) AND title LIKE $2",
        [books.map((book) => book.id), `${prefix}%`],
      );
    } finally {
      await pool.end();
    }
  }
});
