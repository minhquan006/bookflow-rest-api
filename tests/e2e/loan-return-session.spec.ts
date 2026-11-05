import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("peer logout discards a late committed return without retrying or changing its audit", async ({
  page,
  context,
  request,
}, testInfo) => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password)
    throw new Error("SEED_DEMO_PASSWORD is required for loan fixtures.");
  const vi = testInfo.project.name === "mobile";
  const label = (en: string, translated: string) => (vi ? translated : en);
  const suffix = randomUUID().slice(0, 8);
  const admin = await request.post("/api/v1/auth/login", {
    data: { email: "admin@bookflow.test", password },
  });
  expect(admin.status()).toBe(200);
  const headers = {
    Authorization: `Bearer ${(await admin.json()).data.accessToken}`,
  };
  const categories = await request.get("/api/v1/categories?limit=1");
  const title = `Late return ${suffix}`;
  const barcode = `LATE-${suffix}`;
  const created = await request.post("/api/v1/books", {
    headers,
    data: {
      title,
      author: "Synthetic Author",
      isbn: null,
      description: "Return/session regression.",
      categoryId: (await categories.json()).data[0].id,
    },
  });
  expect(created.status()).toBe(201);
  const bookId = (await created.json()).data.id;
  expect(
    (
      await request.post(`/api/v1/books/${bookId}/copies`, {
        headers,
        data: { barcode },
      })
    ).status(),
  ).toBe(201);
  const member = {
    fullName: `Late borrower ${suffix}`,
    email: `late-${suffix}@bookflow.test`,
    password: `Test-passphrase-${suffix}`,
  };
  expect(
    (await request.post("/api/v1/auth/register", { data: member })).status(),
  ).toBe(201);
  const memberLogin = await request.post("/api/v1/auth/login", {
    data: { email: member.email, password: member.password },
  });
  expect(memberLogin.status()).toBe(200);
  const borrowed = await request.post("/api/v1/loans", {
    headers: {
      Authorization: `Bearer ${(await memberLogin.json()).data.accessToken}`,
    },
    data: { bookId },
  });
  expect(borrowed.status()).toBe(201);
  const loanId = (await borrowed.json()).data.id as string;

  await page.goto("/login");
  if (vi) await page.getByLabel("Language", { exact: true }).selectOption("vi");
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
  await expect(
    page.getByRole("button", {
      name: label("Sign out", "Đăng xuất"),
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/loans");
  await page
    .getByRole("button", {
      name: label(
        `Return loan ${loanId.slice(0, 8)}`,
        `Trả sách cho phiếu ${loanId.slice(0, 8)}`,
      ),
      exact: true,
    })
    .click();
  const confirmation = page.getByRole("region", {
    name: label("Confirm this return?", "Xác nhận đã nhận lại sách?"),
  });
  for (const text of [title, barcode, member.fullName])
    await expect(confirmation.getByText(text, { exact: true })).toBeVisible();
  const peer = await context.newPage();
  await peer.goto("/account");
  await expect(
    peer.getByRole("button", {
      name: label("Sign out", "Đăng xuất"),
      exact: true,
    }),
  ).toBeVisible();
  let release!: () => void;
  let entered!: () => void;
  let finished!: () => void;
  let writes = 0;
  let recorded!: { loanId: string; returnedAt: string; returnedBy: string };
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const done = new Promise<void>((r) => {
    finished = r;
  });
  await page.route(`**/api/v1/loans/${loanId}/return`, async (route) => {
    writes++;
    try {
      const result = await route.fetch();
      expect(result.status()).toBe(200);
      recorded = (await result.json()).data;
      entered();
      await gate;
      await route.fulfill({ response: result });
    } finally {
      finished();
    }
  });
  await confirmation
    .getByRole("button", {
      name: label("Confirm return", "Xác nhận trả sách"),
      exact: true,
    })
    .click();
  await started;
  try {
    await expect(
      confirmation.getByRole("button", {
        name: label("Confirm return", "Xác nhận trả sách"),
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      confirmation.getByRole("button", {
        name: label("Cancel", "Hủy"),
        exact: true,
      }),
    ).toBeDisabled();
    const cookies = await context.cookies();
    const refresh = cookies.find((c) => c.name === "bookflow_refresh")!;
    const csrf = cookies.find((c) => c.name === "bookflow_csrf")!;
    const logout = peer.waitForResponse(
      (r) => r.url().endsWith("/auth/logout"),
      { timeout: 5_000 },
    );
    await peer
      .getByRole("button", {
        name: label("Sign out", "Đăng xuất"),
        exact: true,
      })
      .click();
    expect((await logout).status()).toBe(204);
    expect(
      (
        await request.post("/api/v1/auth/refresh", {
          data: {},
          headers: {
            Origin: new URL(peer.url()).origin,
            Cookie: `bookflow_refresh=${refresh.value}; bookflow_csrf=${csrf.value}`,
            "X-CSRF-Token": decodeURIComponent(csrf.value),
          },
        })
      ).status(),
    ).toBe(401);
  } finally {
    release();
    await done;
  }
  await expect(
    page.getByRole("heading", {
      name: label("Sign in to continue", "Đăng nhập để tiếp tục"),
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(vi ? /Đã xác nhận trả sách lúc/ : /Return confirmed at/),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  // This repeat is an explicit API assertion by another staff account, not a UI retry.
  const repeated = await request.put(`/api/v1/loans/${loanId}/return`, {
    headers,
    data: {},
  });
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).data).toEqual(recorded);
  const audit = await request.get(
    "/api/v1/audit-logs?action=loan.returned&limit=100",
    { headers },
  );
  expect(audit.status()).toBe(200);
  expect(
    (await audit.json()).data.filter(
      (entry: { entityId: string }) => entry.entityId === loanId,
    ),
  ).toHaveLength(1);
});
