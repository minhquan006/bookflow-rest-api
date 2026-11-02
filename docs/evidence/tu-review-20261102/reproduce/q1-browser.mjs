import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
const repository = resolve(import.meta.dirname, "../../../..");
const require = createRequire(join(repository, "package.json"));
const { chromium, expect } = require("@playwright/test");
const root = process.argv[2] || repository;
assert.match(
  process.env.REVIEW_SOURCE_SHA ?? "",
  /^[a-f0-9]{40}$/,
  "Provide the exact client source SHA.",
);
const { vi } = await import(
  pathToFileURL(root + "/client/src/i18n/vi.ts").href
);
const origin = process.env.REVIEW_BASE_URL;
assert.ok(origin, "Provide REVIEW_BASE_URL for the reviewed client.");
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname),
  "Local review client required.",
);
const evidence = process.env.REVIEW_OUTPUT_DIR;
assert.ok(evidence, "Choose a new REVIEW_OUTPUT_DIR.");
assert.equal(
  existsSync(join(evidence, "q1-browser.json")),
  false,
  "Report already exists.",
);
mkdirSync(evidence, { recursive: true });
const categoryId = "20000000-0000-4000-8000-000000000001";
const books = Array.from({ length: 25 }, (_, i) => ({
  id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  categoryId,
  title: `Q1 fixture ${i + 1}`,
  author: "Synthetic Author",
  isbn: null,
  description: "Synthetic review fixture",
  archivedAt: null,
  version: 1,
}));
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
});
const results = [];
try {
  for (const mobile of [false, true])
    for (const initialLanguage of ["en", "vi"])
      for (const role of ["MEMBER", "LIBRARIAN"]) {
        let language = initialLanguage;
        const label = (s) => (language === "vi" ? (vi[s] ?? s) : s);
        const interpolate = (s, values) =>
          Object.entries(values).reduce(
            (value, [key, replacement]) =>
              value.replaceAll("{" + key + "}", replacement),
            label(s),
          );
        const context = await browser.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
          isMobile: mobile,
          hasTouch: mobile,
        });
        await context.addCookies([
          { name: "bookflow_csrf", value: "review-csrf", url: origin },
        ]);
        await context.addInitScript(
          (language) => localStorage.setItem("bookflow.language", language),
          language,
        );
        const page = await context.newPage();
        let mutations = 0,
          reads = 0;
        await page.route(/\/api\/v1(?:\/|$)/, async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            path = url.pathname.replace("/api/v1", "");
          if (
            (path.startsWith("/books") || path.startsWith("/categories")) &&
            request.method() !== "GET"
          )
            mutations++;
          let body;
          const user = {
            id: "10000000-0000-4000-8000-000000000001",
            fullName: "Synthetic " + role,
            email: "synthetic@bookflow.test",
            role,
            status: "ACTIVE",
            createdAt: "2026-10-30T00:00:00Z",
          };
          if (path === "/auth/refresh")
            body = {
              data: {
                accessToken: "synthetic-review-token",
                tokenType: "Bearer",
                expiresIn: 900,
                csrfToken: "review-csrf",
                user,
              },
            };
          else if (path === "/categories")
            body = {
              data: [
                {
                  id: categoryId,
                  name: "Synthetic category",
                  slug: "synthetic",
                  createdAt: user.createdAt,
                },
              ],
              pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
            };
          else if (path.endsWith("/availability"))
            body = {
              data: { bookId: url.pathname.split("/")[4], availableCopies: 1 },
            };
          else if (path.endsWith("/copies"))
            body = {
              data: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            };
          else if (path === "/books") {
            const p = Number(url.searchParams.get("page")),
              limit = Number(url.searchParams.get("limit"));
            body = {
              data: books.slice((p - 1) * limit, p * limit),
              pagination: {
                page: p,
                limit,
                total: 25,
                totalPages: Math.ceil(25 / limit),
              },
            };
          } else if (path.startsWith("/books/"))
            body = { data: books.find((b) => b.id === path.split("/")[2]) };
          else
            body = { data: { message: "Frontend and backend are connected." } };
          if (request.method() === "GET") reads++;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { ETag: `"book-${books[0].id}-v1"` },
            body: JSON.stringify(body),
          });
        });
        await page.goto(origin + "/books");
        await expect(
          page.getByRole("heading", {
            name: label("Book catalog"),
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: books[0].title, exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", {
          name: label("Skip to content"),
          exact: true,
        });
        await expect(skip).toBeFocused();
        await skip.press("Enter");
        await expect(page.locator("#main-content")).toBeFocused();
        await page
          .getByLabel(label("Title or author"), { exact: true })
          .fill("fixture");
        await page
          .getByLabel(label("Category"), { exact: true })
          .selectOption(categoryId);
        await page
          .getByLabel(label("Sort by"), { exact: true })
          .selectOption("-title");
        await page
          .getByRole("button", { name: label("Search"), exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: label("Next"), exact: true }),
        ).toBeEnabled();
        await page
          .getByRole("button", { name: label("Next"), exact: true })
          .click();
        await expect(
          page.getByText(
            interpolate("Page {page} of {totalPages}", {
              page: "2",
              totalPages: "13",
            }),
            { exact: true },
          ),
        ).toBeVisible();
        if (role === "LIBRARIAN") {
          await page
            .getByRole("button", { name: label("Add book"), exact: true })
            .click();
          await page
            .getByLabel(label("Title"), { exact: true })
            .fill("Synthetic create draft");
          await page
            .getByLabel(label("Author"), { exact: true })
            .fill("Synthetic draft author");
        }
        const oldReads = reads;
        for (const next of [
          initialLanguage === "en" ? "vi" : "en",
          initialLanguage,
        ]) {
          await page
            .getByLabel(label("Language"), { exact: true })
            .selectOption(next);
          language = next;
          await expect(
            page.getByLabel(label("Title or author"), { exact: true }),
          ).toHaveValue("fixture");
          await expect(page.locator("#catalog-category")).toHaveValue(
            categoryId,
          );
          await expect(
            page.getByLabel(label("Sort by"), { exact: true }),
          ).toHaveValue("-title");
          await expect(
            page.getByText(
              interpolate("Page {page} of {totalPages}", {
                page: "2",
                totalPages: "13",
              }),
              { exact: true },
            ),
          ).toBeVisible();
          if (role === "LIBRARIAN")
            await expect(
              page.getByLabel(label("Title"), { exact: true }),
            ).toHaveValue("Synthetic create draft");
        }
        assert.equal(reads, oldReads, "language changes must not refetch");
        assert.equal(mutations, 0);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          "horizontal overflow",
        );
        if (
          role === "LIBRARIAN" &&
          ((!mobile && language === "en") || (mobile && language === "vi"))
        )
          await page.screenshot({
            path:
              evidence +
              `/q1-${mobile ? "mobile" : "desktop"}-${language}-create.png`,
            fullPage: true,
          });
        if (role === "LIBRARIAN") {
          await page.goto(origin + "/books/" + books[0].id);
          await expect(
            page.getByRole("button", {
              name: label("Edit metadata"),
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByLabel(label("New copy barcode"), { exact: true })
            .fill("SYNTHETIC-COPY-DRAFT");
          await page
            .getByRole("button", { name: label("Edit metadata"), exact: true })
            .click();
          await page
            .getByLabel(label("Title"), { exact: true })
            .fill("Synthetic edit draft");
          for (const next of [
            initialLanguage === "en" ? "vi" : "en",
            initialLanguage,
          ]) {
            await page
              .getByLabel(label("Language"), { exact: true })
              .selectOption(next);
            language = next;
            await expect(
              page.getByLabel(label("Title"), { exact: true }),
            ).toHaveValue("Synthetic edit draft");
            await expect(
              page.getByLabel(label("New copy barcode"), { exact: true }),
            ).toHaveValue("SYNTHETIC-COPY-DRAFT");
          }
          assert.equal(mutations, 0);
        }
        results.push({
          viewport: mobile ? "mobile" : "desktop",
          locale: initialLanguage,
          role,
          queryCategorySortPage: true,
          languageRoundTrip: true,
          createAndEditBarcode: role === "LIBRARIAN",
          noMutation: true,
          skipLinkKeyboardFocus: true,
          noHorizontalOverflow: true,
        });
        console.log(
          "PASS Q1 " +
            (mobile ? "mobile" : "desktop") +
            " " +
            initialLanguage +
            " " +
            role,
        );
        await context.close();
      }
  writeFileSync(
    evidence + "/q1-browser.json",
    JSON.stringify(
      {
        head: process.env.REVIEW_SOURCE_SHA,
        environment: "Linux Chromium",
        api: "mocked HTTP for frontend/keyboard/CSS review; not backend E2E evidence",
        cases: results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
