import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";

const repository = resolve(import.meta.dirname, "../../../..");
const require = createRequire(join(repository, "package.json"));
const { chromium, request, expect } = require("@playwright/test");
const envFile = join(repository, ".env");
const settings = {
  ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}),
  ...process.env,
};
assert.ok(
  settings.SEED_DEMO_PASSWORD,
  "SEED_DEMO_PASSWORD required; never print it.",
);
assert.match(
  process.env.REVIEW_DATABASE_NAME ?? "",
  /^[a-z][a-z0-9_]*_test$/,
  "Target API must use an isolated _test DB.",
);
assert.match(
  process.env.REVIEW_SOURCE_SHA ?? "",
  /^[a-f0-9]{40}$/,
  "Provide the exact API/client source SHA.",
);
const origin = process.env.REVIEW_BASE_URL;
assert.ok(origin, "Provide REVIEW_BASE_URL for the isolated review stack.");
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname),
  "Local review stack required.",
);
const evidence = process.env.REVIEW_OUTPUT_DIR;
assert.ok(
  evidence,
  "Choose a new REVIEW_OUTPUT_DIR; preserve historical evidence.",
);
assert.equal(
  existsSync(join(evidence, "a2-browser.json")),
  false,
  "Report already exists.",
);
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
});
const api = await request.newContext({ baseURL: origin });
const results = [];
async function apiLogin(email, password) {
  const r = await api.post("/api/v1/auth/login", { data: { email, password } });
  assert.equal(r.status(), 200, "API fixture login");
  return (await r.json()).data;
}
async function openSession(page, email, password, locale) {
  await page.goto(origin + "/login");
  if (locale === "vi")
    await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel(locale === "vi" ? "Mật khẩu" : "Password", { exact: true })
    .fill(password);
  await page
    .locator("form")
    .getByRole("button", {
      name: locale === "vi" ? "Đăng nhập" : "Sign in",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: locale === "vi" ? "Danh mục sách" : "Book catalog",
      exact: true,
    }),
  ).toBeVisible();
}
try {
  const administrator = await apiLogin(
    "admin@bookflow.test",
    settings.SEED_DEMO_PASSWORD,
  );
  const adminHeaders = { Authorization: `Bearer ${administrator.accessToken}` };
  for (const mobile of [false, true])
    for (const locale of ["en", "vi"])
      for (const role of ["LIBRARIAN", "ADMIN"]) {
        const label = (en, vi) => (locale === "vi" ? vi : en);
        const caseName = `${mobile ? "mobile" : "desktop"}-${locale}-${role.toLowerCase()}`;
        const suffix = randomUUID().slice(0, 8);
        const email = `tu-review-${suffix}@bookflow.test`,
          password = `Review-${suffix}-Password`;
        const fullName = `Synthetic Borrower ${suffix}`,
          title = `Tu A2 review ${suffix}`,
          barcode = `TU-A2-${suffix}`;
        const category = (
          await (await api.get("/api/v1/categories?limit=1")).json()
        ).data[0].id;
        let r = await api.post("/api/v1/books", {
          headers: adminHeaders,
          data: {
            categoryId: category,
            title,
            author: "Synthetic Review",
            isbn: null,
            description: "Isolated reviewer test database",
          },
        });
        assert.equal(r.status(), 201, "create book");
        const book = (await r.json()).data;
        r = await api.post(`/api/v1/books/${book.id}/copies`, {
          headers: adminHeaders,
          data: { barcode },
        });
        assert.equal(r.status(), 201, "create copy");
        r = await api.post("/api/v1/auth/register", {
          data: { fullName, email, password },
        });
        assert.equal(r.status(), 201, "register review member");
        const member = await apiLogin(email, password);
        r = await api.post("/api/v1/loans", {
          headers: { Authorization: `Bearer ${member.accessToken}` },
          data: { bookId: book.id },
        });
        assert.equal(r.status(), 201, "create review loan");
        const loan = (await r.json()).data;
        assert.equal(
          "borrower" in loan,
          false,
          "MEMBER DTO must omit borrower",
        );
        const context = await browser.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
          isMobile: mobile,
          hasTouch: mobile,
        });
        const page = await context.newPage();
        let returnRequests = 0;
        const returnPath = `/api/v1/loans/${loan.id}/return`;
        page.on("request", (request) => {
          if (
            new URL(request.url()).pathname === returnPath &&
            request.method() === "PUT"
          )
            returnRequests++;
        });
        await openSession(page, email, password, locale);
        await page.goto(origin + "/loans");
        await expect(
          page.getByRole("heading", {
            name: label("My loans", "Phiếu mượn của tôi"),
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await expect(page.getByText(barcode, { exact: true })).toBeVisible();
        await expect(
          page.getByRole("columnheader", {
            name: label("Borrower", "Người mượn"),
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: /^(Return loan|Trả sách cho phiếu)/,
          }),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: label(
              "View loan " + loan.id.slice(0, 8),
              "Xem phiếu mượn " + loan.id.slice(0, 8),
            ),
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("region", {
            name: label("Loan details", "Chi tiết phiếu mượn"),
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: label("Sign out", "Đăng xuất"),
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("banner").getByRole("button", {
            name: label("Sign in", "Đăng nhập"),
            exact: true,
          }),
        ).toBeVisible();
        const staffEmail =
          role === "ADMIN" ? "admin@bookflow.test" : "librarian@bookflow.test";
        await page.goto(origin + "/login");
        await page.getByLabel("Email", { exact: true }).fill(staffEmail);
        await page
          .getByLabel(label("Password", "Mật khẩu"), { exact: true })
          .fill(settings.SEED_DEMO_PASSWORD);
        await page
          .locator("form")
          .getByRole("button", {
            name: label("Sign in", "Đăng nhập"),
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: label("Book catalog", "Danh mục sách"),
            exact: true,
          }),
        ).toBeVisible();
        await page.goto(origin + "/loans");
        await expect(
          page.getByRole("heading", {
            name: label("Library loans", "Phiếu mượn thư viện"),
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByLabel(label("Loan status", "Trạng thái phiếu mượn"))
          .selectOption("ACTIVE");
        await expect(page.getByText(fullName, { exact: true })).toBeVisible();
        await page
          .getByRole("button", {
            name: label(
              "View loan " + loan.id.slice(0, 8),
              "Xem phiếu mượn " + loan.id.slice(0, 8),
            ),
            exact: true,
          })
          .click();
        const returnButton = page.getByRole("button", {
          name: label(
            "Return loan " + loan.id.slice(0, 8),
            "Trả sách cho phiếu " + loan.id.slice(0, 8),
          ),
          exact: true,
        });
        await returnButton.click();
        const confirmation = page.getByRole("region", {
          name: label("Confirm this return?", "Xác nhận đã nhận lại sách?"),
          exact: true,
        });
        for (const value of [title, barcode, fullName])
          await expect(
            confirmation.getByText(value, { exact: true }),
          ).toBeVisible();
        await confirmation
          .getByRole("button", { name: label("Cancel", "Hủy"), exact: true })
          .click();
        await expect(confirmation).toHaveCount(0);
        assert.equal(returnRequests, 0, "cancel must not PUT");
        await returnButton.click();
        const confirm = confirmation.getByRole("button", {
          name: label("Confirm return", "Xác nhận trả sách"),
          exact: true,
        });
        const cancel = confirmation.getByRole("button", {
          name: label("Cancel", "Hủy"),
          exact: true,
        });
        let release;
        await page.route(
          "**" + returnPath,
          (route) =>
            new Promise((resolve) => {
              release = () => route.abort("failed").then(resolve);
            }),
        );
        await confirm.click();
        await expect(confirm).toBeDisabled();
        await expect(cancel).toBeDisabled();
        await expect.poll(() => typeof release).toBe("function");
        await release();
        await expect(confirmation.getByRole("alert")).toBeVisible();
        await expect(confirm).toBeEnabled();
        assert.equal(returnRequests, 1, "network error must not retry");
        await page.unroute("**" + returnPath);
        await page.route("**" + returnPath, (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                loanId: loan.id,
                returnedBy: [administrator.user.id],
                returnedAt: "2026-02-30T10:00:00Z",
              },
            }),
          }),
        );
        await confirm.click();
        await expect(confirmation.getByRole("alert")).toContainText(
          label(
            "The return response could not be verified. Refresh the history before trying again.",
            "Không thể xác minh kết quả trả sách. Hãy tải lại lịch sử trước khi thử lại.",
          ),
        );
        await expect(confirm).toBeEnabled();
        assert.equal(returnRequests, 2, "malformed response must not retry");
        const otherLocale = locale === "vi" ? "en" : "vi";
        await page
          .getByLabel(label("Language", "Ngôn ngữ"), { exact: true })
          .selectOption(otherLocale);
        const translatedConfirmation = page.getByRole("region", {
          name:
            otherLocale === "vi"
              ? "Xác nhận đã nhận lại sách?"
              : "Confirm this return?",
          exact: true,
        });
        await expect(translatedConfirmation.getByRole("alert")).toContainText(
          otherLocale === "vi"
            ? "Không thể xác minh kết quả trả sách. Hãy tải lại lịch sử trước khi thử lại."
            : "The return response could not be verified. Refresh the history before trying again.",
        );
        await page
          .getByLabel(otherLocale === "vi" ? "Ngôn ngữ" : "Language", {
            exact: true,
          })
          .selectOption(locale);
        await expect(confirm).toBeEnabled();
        assert.equal(
          returnRequests,
          2,
          "language changes must not retry return",
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        assert.equal(overflow, false, "page must not overflow horizontally");
        if (mobile && locale === "vi" && role === "ADMIN")
          await page.screenshot({
            path: evidence + "/a2-mobile-vi-error.png",
            fullPage: true,
          });
        await page.unroute("**" + returnPath);
        const received = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === returnPath &&
            r.request().method() === "PUT",
        );
        await confirm.click();
        const actual = await received;
        assert.equal(actual.status(), 200, "real return status");
        const original = (await actual.json()).data;
        await expect(
          page.getByText(
            locale === "vi"
              ? /Đã xác nhận trả sách lúc/
              : /Return confirmed at/,
          ),
        ).toBeVisible();
        await expect(confirmation).toHaveCount(0);
        assert.equal(
          returnRequests,
          3,
          "one request per explicit confirmation",
        );
        const details = page.getByRole("region", {
          name: label("Loan details", "Chi tiết phiếu mượn"),
          exact: true,
        });
        await expect(
          details.getByText(original.returnedBy, { exact: true }),
        ).toBeVisible();
        const expectedTime = await page.evaluate(
          ({ value, locale }) =>
            new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(value)),
          { value: original.returnedAt, locale },
        );
        const returnedField = details
          .locator("dt")
          .filter({
            hasText: new RegExp("^" + label("Returned", "Đã trả") + "$"),
          })
          .locator("xpath=following-sibling::dd[1]");
        await expect(returnedField).toHaveText(expectedTime);
        if (!mobile && locale === "en" && role === "LIBRARIAN")
          await page.screenshot({
            path: evidence + "/a2-desktop-en-success.png",
            fullPage: true,
          });
        const secondStaff =
          role === "ADMIN"
            ? await apiLogin(
                "librarian@bookflow.test",
                settings.SEED_DEMO_PASSWORD,
              )
            : administrator;
        r = await api.put(returnPath, {
          headers: { Authorization: `Bearer ${secondStaff.accessToken}` },
          data: {},
        });
        assert.equal(r.status(), 200);
        const repeated = (await r.json()).data;
        assert.equal(
          repeated.returnedAt,
          original.returnedAt,
          "idempotent timestamp",
        );
        assert.equal(
          repeated.returnedBy,
          original.returnedBy,
          "idempotent staff",
        );
        r = await api.get("/api/v1/audit-logs?action=loan.returned&limit=100", {
          headers: adminHeaders,
        });
        assert.equal(r.status(), 200);
        assert.equal(
          (await r.json()).data.filter((x) => x.entityId === loan.id).length,
          1,
          "one audit event",
        );
        results.push({
          case: caseName,
          staffRole: role,
          memberPrivacy: true,
          identity: true,
          cancelWithoutMutation: true,
          pendingLocked: true,
          networkError: true,
          malformedResponse: true,
          noAutomaticRetry: true,
          errorLanguageRoundTrip: true,
          realReturn: true,
          idempotency: true,
          singleAudit: true,
          noHorizontalOverflow: true,
        });
        console.log("PASS A2 " + caseName + " " + role);
        await context.close();
      }
  writeFileSync(
    evidence + "/a2-browser.json",
    JSON.stringify(
      {
        head: process.env.REVIEW_SOURCE_SHA,
        database: process.env.REVIEW_DATABASE_NAME,
        environment: "Linux Chromium",
        api: "real API and isolated test DB; network/malformed response injected only for two explicit failure checks",
        cases: results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await api.dispose();
  await browser.close();
}
