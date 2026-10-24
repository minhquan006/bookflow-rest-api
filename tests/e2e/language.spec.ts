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
