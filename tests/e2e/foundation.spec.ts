import { test, expect } from "@playwright/test";

test("Swagger loads the actual OpenAPI contract", async ({ page, baseURL }) => {
  const docsBase = process.env.E2E_EXTERNAL ? baseURL : "http://127.0.0.1:3000";
  await page.goto(`${docsBase}/docs/`);
  await expect(page.locator(".swagger-ui .info .title")).toContainText(
    "BookFlow",
  );
  await expect(page.locator(".swagger-ui .opblock").first()).toBeVisible();
});

test("foundation connects to the real API through the frontend proxy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = page.waitForResponse(
    (res) => new URL(res.url()).pathname === "/api/v1",
  );
  await page.goto("/");
  expect((await response).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Good books/ })).toBeVisible();
  await expect(
    page.getByText("Frontend and backend are connected."),
  ).toBeVisible();
  expect(errors).toEqual([]);
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
});

test("connection failure is visible and can recover", async ({ page }) => {
  await page.route("**/api/v1", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "Service Unavailable",
        status: 503,
        detail: "Service temporarily unavailable.",
        code: "SERVICE_UNAVAILABLE",
        requestId: "e2e-request",
      }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText("Service temporarily unavailable.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1");
  await page.getByRole("button", { name: /refresh connection|retry/i }).click();
  await expect(
    page.getByText("Frontend and backend are connected."),
  ).toBeVisible();
});
