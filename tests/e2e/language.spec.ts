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

test("signed-in member keeps applied search, category, sort and page across EN–VI–EN", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password)
    throw new Error("SEED_DEMO_PASSWORD is required for language fixtures.");
  const staff = await request.post("/api/v1/auth/login", {
    data: { email: "librarian@bookflow.test", password },
  });
  expect(staff.status()).toBe(200);
  const access = (await staff.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${access}` };
  const categoryResponse = await request.post("/api/v1/categories", {
    headers,
    data: { name: `Language ${suffix}`, slug: `language-${suffix}` },
  });
  expect(categoryResponse.status()).toBe(201);
  const category = (await categoryResponse.json()).data;
  const member = {
    fullName: `Language ${suffix}`,
    email: `language-${suffix}@bookflow.test`,
    password: `Test-passphrase-${suffix}`,
  };
  expect(
    (await request.post("/api/v1/auth/register", { data: member })).status(),
  ).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(member.email);
  await page.getByLabel("Password", { exact: true }).fill(member.password);
  const initial = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/books" &&
      response.request().method() === "GET",
  );
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  const limit = (await (await initial).json()).pagination.limit as number;
  // Derive fixture size from the actual page size, so T2 can change it independently.
  for (let index = 0; index <= limit; index++) {
    const created = await request.post("/api/v1/books", {
      headers,
      data: {
        title: `Language ${suffix} ${String(index).padStart(3, "0")}`,
        author: "Language Test",
        categoryId: category.id,
        isbn: null,
        description: "Synthetic language fixture.",
      },
    });
    expect(created.status()).toBe(201);
  }
  await page.getByLabel("Title or author").fill(`Language ${suffix}`);
  await page.getByLabel("Category", { exact: true }).selectOption(category.id);
  await page.getByLabel("Sort by").selectOption("-title");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  const titles = await page
    .getByRole("article")
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  let writes = 0;
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      !request.url().includes("/auth/")
    )
      writes++;
  });
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(page.getByLabel("Tên sách hoặc tác giả")).toHaveValue(
    `Language ${suffix}`,
  );
  await expect(page.getByLabel("Thể loại", { exact: true })).toHaveValue(
    category.id,
  );
  await expect(page.getByLabel("Sắp xếp theo")).toHaveValue("-title");
  await expect(page.getByText("Trang 2 / 2", { exact: true })).toBeVisible();
  expect(
    await page
      .getByRole("article")
      .getByRole("heading", { level: 2 })
      .allTextContents(),
  ).toEqual(titles);
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(page.getByLabel("Title or author")).toHaveValue(
    `Language ${suffix}`,
  );
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    category.id,
  );
  await expect(page.getByLabel("Sort by")).toHaveValue("-title");
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  expect(
    await page
      .getByRole("article")
      .getByRole("heading", { level: 2 })
      .allTextContents(),
  ).toEqual(titles);
  expect(writes).toBe(0);
});
