import { test, expect } from "@playwright/test";

test("catalog searches and filters real seeded books", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();

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
    .fill("");
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

  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
});

test("catalog paginates and displays an empty search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();

  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();

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
