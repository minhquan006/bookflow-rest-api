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
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      /\/api\/v1\/(books|copies)(\/|$)/.test(new URL(request.url()).pathname)
    )
      mutations.push(request.url());
  });
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
  const category = create.getByLabel("Category", { exact: true });
  await expect(category.locator("option").nth(1)).toBeAttached();
  await category.selectOption({ index: 1 });
  const categoryId = await category.inputValue();
  const beforeCreate = mutations.length;
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(
    page
      .getByRole("form", { name: "Tạo sách", exact: true })
      .getByLabel("Tên sách", { exact: true }),
  ).toHaveValue(title);
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(create.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(create.getByLabel("Author", { exact: true })).toHaveValue(
    "BookFlow Test Author",
  );
  await expect(create.getByLabel("Description", { exact: true })).toHaveValue(
    "Synthetic browser validation.",
  );
  await expect(category).toHaveValue(categoryId);
  expect(mutations).toHaveLength(beforeCreate);
  await create
    .getByRole("button", { name: "Create book", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByLabel("New copy barcode").fill(`CAT-${suffix}`);
  const beforeCopy = mutations.length;
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.getByLabel("Mã vạch bản sách mới")).toHaveValue(
    `CAT-${suffix}`,
  );
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(page.getByLabel("New copy barcode")).toHaveValue(
    `CAT-${suffix}`,
  );
  expect(mutations).toHaveLength(beforeCopy);
  await page.getByRole("button", { name: "Add copy", exact: true }).click();
  await expect(page.getByText(`CAT-${suffix}`, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const edit = page.getByRole("form", { name: "Edit book metadata" });
  await edit.getByLabel("Title", { exact: true }).fill(`${title} revised`);
  const beforeEdit = mutations.length;
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.getByLabel("Tên sách", { exact: true })).toHaveValue(
    `${title} revised`,
  );
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(edit.getByLabel("Title", { exact: true })).toHaveValue(
    `${title} revised`,
  );
  expect(mutations).toHaveLength(beforeEdit);
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
