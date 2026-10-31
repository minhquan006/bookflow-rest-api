import { test, expect } from "@playwright/test";

test("language choice survives navigation and reload without losing form input", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill("Nguyễn Minh Quân");
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Test-password-language");
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue(
    "Nguyễn Minh Quân",
  );
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue(
    "Test-password-language",
  );
  await page
    .locator("form")
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByText("Vui lòng nhập địa chỉ email hợp lệ."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("button", { name: "Danh mục sách", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Danh mục sách", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Tên sách hoặc tác giả")
    .fill("no-matching-book-language-test");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(
    page.getByText("Không tìm thấy sách. Hãy thử từ khóa hoặc thể loại khác."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ngôn ngữ", { exact: true })).toHaveValue("vi");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Book catalog", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("staff Catalog drafts survive language changes without submissions", async ({
  page,
}) => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("SEED_DEMO_PASSWORD is required.");
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/v1\/(books|copies)/.test(request.url()) &&
      !["GET", "HEAD"].includes(request.method())
    )
      mutations.push(request.method());
  });
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("librarian@bookflow.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Unsubmitted create draft");
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.getByLabel("Tên sách", { exact: true })).toHaveValue(
    "Unsubmitted create draft",
  );
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsubmitted create draft",
  );
  await page.goto("/books/10000000-0000-4000-8000-000000000001");
  await page.getByLabel("New copy barcode").fill("Unsubmitted barcode");
  await page
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Unsubmitted edit draft");
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.getByLabel("Tên sách", { exact: true })).toHaveValue(
    "Unsubmitted edit draft",
  );
  await expect(page.getByLabel("Mã vạch bản sách mới")).toHaveValue(
    "Unsubmitted barcode",
  );
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsubmitted edit draft",
  );
  expect(mutations).toEqual([]);
});
