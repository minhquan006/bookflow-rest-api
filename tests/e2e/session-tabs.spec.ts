import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

async function account(request: APIRequestContext) {
  const suffix = randomUUID().slice(0, 8);
  const user = {
    fullName: `Tabs ${suffix}`,
    email: `tabs-${suffix}@bookflow.test`,
    password: `Test-passphrase-${suffix}`,
  };
  expect(
    (await request.post("/api/v1/auth/register", { data: user })).status(),
  ).toBe(201);
  return user;
}
async function signIn(page: Page, user: Awaited<ReturnType<typeof account>>) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST",
  );
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(
    page.getByRole("button", { name: user.fullName, exact: true }),
  ).toBeVisible();
  return (await result.json()).data.expiresIn as number;
}
const rotation = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().endsWith("/auth/refresh") && r.request().method() === "POST",
  );
async function rotate(page: Page, seconds: number) {
  const response = rotation(page);
  await page.clock.fastForward((seconds - 30) * 1_000);
  expect((await response).status()).toBe(200);
  await page.waitForFunction(async () => {
    const locks = await navigator.locks.query();
    return locks.held?.length === 0 && locks.pending?.length === 0;
  });
}
async function signedOut(page: Page) {
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
}

test("two tabs serialize rotations, use the latest CSRF and revoke the actual refresh family", async ({
  page,
  context,
  request,
}) => {
  const user = await account(request);
  await page.clock.install();
  const ttl = await signIn(page, user);
  const peer = await context.newPage();
  const restored = rotation(peer);
  await peer.goto("/account");
  expect((await restored).status()).toBe(200);
  await expect(
    peer.getByRole("heading", { name: user.fullName, exact: true }),
  ).toBeVisible();
  // B restored/rotated the shared cookie; A's next proactive refresh must use it.
  await rotate(page, ttl);
  await expect(
    page.getByRole("button", { name: user.fullName, exact: true }),
  ).toBeVisible();
  const a = rotation(page);
  const b = rotation(peer);
  // Playwright's clock belongs to the browser context: one tick drives both tabs.
  await page.clock.fastForward((ttl - 30) * 1_000);
  expect((await a).status()).toBe(200);
  expect((await b).status()).toBe(200);
  // Ensure B is the last rotator, then logout from A using B's latest cookie.
  await page.waitForFunction(async () => {
    const locks = await navigator.locks.query();
    return locks.held?.length === 0 && locks.pending?.length === 0;
  });
  const lastRotation = rotation(peer);
  await peer.reload();
  expect((await lastRotation).status()).toBe(200);
  await expect(
    peer.getByRole("heading", { name: user.fullName, exact: true }),
  ).toBeVisible();
  const cookies = await context.cookies();
  const refresh = cookies.find((cookie) => cookie.name === "bookflow_refresh")!;
  const csrf = cookies.find((cookie) => cookie.name === "bookflow_csrf")!;
  expect(refresh).toBeDefined();
  expect(csrf).toBeDefined();
  const logout = page.waitForResponse((r) => r.url().endsWith("/auth/logout"));
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await logout).status()).toBe(204);
  // Neither a hidden cookie nor a late UI update is accepted as proof of revocation.
  const revoked = await request.post("/api/v1/auth/refresh", {
    data: {},
    headers: {
      Origin: new URL(page.url()).origin,
      Cookie: `bookflow_refresh=${refresh.value}; bookflow_csrf=${csrf.value}`,
      "X-CSRF-Token": decodeURIComponent(csrf.value),
    },
  });
  expect(revoked.status()).toBe(401);
  await signedOut(page);
  await signedOut(peer);
  await peer.reload();
  await expect(
    peer.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
});

test("logout in a peer tab wins over an in-flight refresh response", async ({
  page,
  context,
  request,
}) => {
  const user = await account(request);
  await page.clock.install();
  const ttl = await signIn(page, user);
  const peer = await context.newPage();
  await peer.goto("/account");
  await expect(
    peer.getByRole("heading", { name: user.fullName, exact: true }),
  ).toBeVisible();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route("**/api/v1/auth/refresh", async (route) => {
    const result = await route.fetch();
    expect(result.status()).toBe(200);
    entered();
    await gate;
    await route.fulfill({ response: result });
  });
  const tick = page.clock.fastForward((ttl - 30) * 1_000);
  await started;
  const logout = peer.waitForResponse((r) => r.url().endsWith("/auth/logout"));
  await peer.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: user.fullName, exact: true }),
  ).toHaveCount(0);
  release();
  await tick;
  expect((await logout).status()).toBe(204);
  await signedOut(page);
  await signedOut(peer);
});

test("a login in another tab removes the previous identity and reload follows only the current account", async ({
  page,
  context,
  request,
}) => {
  const first = await account(request);
  const second = await account(request);
  await signIn(page, first);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: first.fullName, exact: true }),
  ).toBeVisible();
  const peer = await context.newPage();
  await peer.goto("/account");
  await expect(
    peer.getByRole("heading", { name: first.fullName, exact: true }),
  ).toBeVisible();
  await signIn(peer, second);
  await expect(
    page.getByRole("heading", { name: first.fullName, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: second.fullName, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(first.email, { exact: true })).toHaveCount(0);
});

test("unsupported coordination leaves public browsing available and refuses sign-in", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "locks", { value: undefined }),
  );
  await page.goto("/books");
  await expect(
    page.getByRole("heading", { name: "Book catalog", exact: true }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("member@bookflow.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  let authRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/login")) authRequests++;
  });
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Secure session coordination is unavailable",
  );
  expect(authRequests).toBe(0);
});
