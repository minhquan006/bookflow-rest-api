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
  await expect(page.getByText("Borrowing is coming soon.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /borrow|my loans/i }),
  ).toHaveCount(0);

  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
});

test("member can view availability without unavailable borrowing or loan navigation", async ({
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
    page.getByRole("button", { name: /^(my|all) loans$/i }),
  ).toHaveCount(0);
  await page.goto("/books/10000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", {
      name: "Practical Web Foundations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/^\d+ available cop(?:y|ies)$/)).toBeVisible();
  await expect(page.getByText("Borrowing is coming soon.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /borrow|my loans/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /borrow|my loans/i }),
  ).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByText("YOUR ACCOUNT", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /loans/i })).toHaveCount(0);
  expect(loanRequests).toEqual([]);
});

test("catalog paginates and displays an empty search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();

  await expect(
    page.getByText(/^Page 1 of (?:[2-9]|[1-9][0-9]+)$/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText(/^Page 2 of (?:[2-9]|[1-9][0-9]+)$/),
  ).toBeVisible();

  await page
    .getByRole("searchbox", {
      name: "Title or author",
    })
    .fill("zzzz-no-matching-book-987654");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(
    page.getByText("No books found. Try another search or category.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("0 books found", { exact: true })).toBeVisible();
});
