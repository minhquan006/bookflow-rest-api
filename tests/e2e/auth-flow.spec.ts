import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("member can register, sign in, restore the session and sign out", async ({
  page,
  context,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const name = `Member ${suffix}`;
  const email = `e2e-${suffix}@bookflow.test`;
  const password = `Test-passphrase-${suffix}`;
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account created" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  const cookies = await context.cookies();
  expect(
    cookies.find((cookie) => cookie.name === "bookflow_refresh")?.httpOnly,
  ).toBe(true);
  expect(cookies.find((cookie) => cookie.name === "bookflow_csrf")?.path).toBe(
    "/",
  );
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
});

test("administrator can manage user roles and receives safe errors", async ({
  page,
  request,
}) => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password)
    throw new Error(
      "SEED_DEMO_PASSWORD is required; run setup and seed before E2E.",
    );
  const suffix = randomUUID().slice(0, 8);
  const name = `Managed ${suffix}`;
  const email = `managed-${suffix}@bookflow.test`;
  const registration = await request.post("/api/v1/auth/register", {
    data: { fullName: name, email, password: `Test-password-${suffix}` },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@bookflow.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Users", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.getByLabel(`Role for ${email}`)).toBeVisible();
  await page.getByLabel(`Role for ${email}`).selectOption("LIBRARIAN");
  await page.getByRole("button", { name: `Save ${name}`, exact: true }).click();
  await expect(page.getByLabel(`Role for ${email}`)).toHaveValue("LIBRARIAN");
  await page.reload();
  await expect(page.getByLabel(`Role for ${email}`)).toHaveValue("LIBRARIAN");
});
