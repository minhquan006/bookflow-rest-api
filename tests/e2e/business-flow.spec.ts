import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("member borrows and staff returns the copy, with dashboard and audit evidence", async ({
  page,
  request,
}, testInfo) => {
  // Exercise the same business contract in English on desktop and Vietnamese on mobile.
  const vietnamese = testInfo.project.name === "mobile";
  const label = (english: string, translated: string) =>
    vietnamese ? translated : english;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("SEED_DEMO_PASSWORD required for demo roles.");
  const suffix = randomUUID().slice(0, 8);
  const email = `borrow-${suffix}@bookflow.test`;
  const memberPassword = `Browser-test-${suffix}`;
  const login = await request.post("/api/v1/auth/login", {
    data: { email: "admin@bookflow.test", password },
  });
  expect(login.status()).toBe(200);
  const adminToken = (await login.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${adminToken}` };
  const categoryResponse = await request.get("/api/v1/categories?limit=1");
  const categoryId = (await categoryResponse.json()).data[0].id;
  const title = `Borrowing story ${suffix}`;
  const bookResponse = await request.post("/api/v1/books", {
    headers,
    data: {
      categoryId,
      isbn: null,
      title,
      author: "Synthetic Test Author",
      description: "Browser borrowing validation.",
    },
  });
  expect(bookResponse.status()).toBe(201);
  const bookId = (await bookResponse.json()).data.id;
  const copyResponse = await request.post(`/api/v1/books/${bookId}/copies`, {
    headers,
    data: { barcode: `LOAN-${suffix}` },
  });
  expect(copyResponse.status()).toBe(201);
  const registered = await request.post("/api/v1/auth/register", {
    data: { fullName: `Borrower ${suffix}`, email, password: memberPassword },
  });
  expect(registered.status()).toBe(201);
  await page.goto("/login");
  if (vietnamese)
    await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel(label("Password", "Mật khẩu"), { exact: true })
    .fill(memberPassword);
  await page
    .locator("form")
    .getByRole("button", { name: label("Sign in", "Đăng nhập"), exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: label("Book catalog", "Danh mục sách") }),
  ).toBeVisible();
  await page.goto(`/books/${bookId}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const borrowed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/loans") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: label("Borrow this book", "Mượn sách này"),
      exact: true,
    })
    .click();
  const borrowResponse = await borrowed;
  expect(borrowResponse.status()).toBe(201);
  const loanId = (await borrowResponse.json()).data.id as string;
  await expect(
    page.getByText(
      label(
        "Book borrowed successfully. You can review its due date in My loans.",
        "Mượn sách thành công. Bạn có thể xem hạn trả trong mục Phiếu mượn của tôi.",
      ),
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: label("My loans", "Phiếu mượn của tôi"),
      exact: true,
    })
    .last()
    .click();
  await expect(
    page.getByRole("heading", {
      name: label("My loans", "Phiếu mượn của tôi"),
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: label(
        `View loan ${loanId.slice(0, 8)}`,
        `Xem phiếu mượn ${loanId.slice(0, 8)}`,
      ),
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: label("Sign out", "Đăng xuất"), exact: true })
    .click();
  await expect(
    page.getByRole("banner").getByRole("button", {
      name: label("Sign in", "Đăng nhập"),
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("librarian@bookflow.test");
  await page
    .getByLabel(label("Password", "Mật khẩu"), { exact: true })
    .fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: label("Sign in", "Đăng nhập"), exact: true })
    .click();
  await page
    .getByRole("button", {
      name: label("All loans", "Tất cả phiếu mượn"),
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: label("Library loans", "Phiếu mượn thư viện"),
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: label(
        `Return loan ${loanId.slice(0, 8)}`,
        `Trả sách cho phiếu ${loanId.slice(0, 8)}`,
      ),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: label("Confirm return", "Xác nhận trả sách"),
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      vietnamese ? /Đã xác nhận trả sách lúc/ : /Return confirmed at/,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: label("Dashboard", "Thống kê"), exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: vietnamese ? /Thống kê thư viện/ : /Dashboard/i,
    }),
  ).toBeVisible();
  const check = await request.get(`/api/v1/loans/${loanId}`, { headers });
  expect(check.status()).toBe(200);
  expect((await check.json()).data.returnedAt).toBeTruthy();
  const audit = await request.get(
    "/api/v1/audit-logs?action=loan.returned&limit=100",
    { headers },
  );
  expect(audit.status()).toBe(200);
  expect(
    (await audit.json()).data.some(
      (entry: { entityId: string }) => entry.entityId === loanId,
    ),
  ).toBe(true);
});
