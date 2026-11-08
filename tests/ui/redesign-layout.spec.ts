import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1024, 1440]) {
  test(`redesign keeps real screens usable at ${width}px with reduced motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    for (const route of ["/", "/books", "/login", "/register"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (route === "/books")
        await expect(page.getByText(/\d+ books found/)).toBeVisible();
      await expect(page.locator(".feedback--loading")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${width}-${route === "/" ? "home" : route.slice(1)}.png`,
        ),
        fullPage: true,
      });
    }
    const password = process.env.SEED_DEMO_PASSWORD;
    if (!password) throw new Error("A seeded local test account is required.");
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("admin@bookflow.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    for (const route of [
      "/books",
      "/categories",
      "/dashboard",
      "/users",
      "/audit-logs",
      "/loans",
      "/account",
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole("button", { name: "Sign out", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".feedback--loading")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      const motion = await page
        .locator("main > :first-child")
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
      expect(motion).toBeLessThanOrEqual(0.001);
      await page.screenshot({
        path: testInfo.outputPath(`${width}-admin-${route.slice(1)}.png`),
        fullPage: true,
      });
    }
    if (width < 768) {
      const toggle = page.getByRole("button", {
        name: "Main navigation",
        exact: true,
      });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("navigation", { name: "Main navigation", exact: true }),
      ).toBeHidden();
      await page.keyboard.press("Space");
      await expect(
        page.getByRole("navigation", { name: "Main navigation", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Catalog", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Book catalog", exact: true }),
      ).toBeVisible();
    }
    expect(consoleErrors).toEqual([]);
  });
}
