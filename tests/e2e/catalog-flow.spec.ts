import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("staff can create edit and archive a book with a physical copy", async ({
  page,
}) => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password)
    throw new Error(
      "SEED_DEMO_PASSWORD is required for seeded staff accounts.",
    );
  const suffix = randomUUID().slice(0, 8);
  const title = `Catalog test ${suffix}`;
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("librarian@bookflow.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Book catalog" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  const create = page.getByRole("form", { name: "Create book" });
  await create.getByLabel("Title", { exact: true }).fill(title);
  await create
    .getByLabel("Author", { exact: true })
    .fill("BookFlow Test Author");
  await create
    .getByLabel("Description", { exact: true })
    .fill("Synthetic browser validation.");
  await create
    .getByRole("button", { name: "Create book", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByLabel("New copy barcode").fill(`CAT-${suffix}`);
  await page.getByRole("button", { name: "Add copy", exact: true }).click();
  await expect(page.getByText(`CAT-${suffix}`, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const edit = page.getByRole("form", { name: "Edit book metadata" });
  await edit.getByLabel("Title", { exact: true }).fill(`${title} revised`);
  await edit.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${title} revised`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive book", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(
    page.getByText("Book archived. Its borrowing history is preserved."),
  ).toBeVisible();
  await expect(
    page.getByText("Archived", { exact: true }).first(),
  ).toBeVisible();
});
