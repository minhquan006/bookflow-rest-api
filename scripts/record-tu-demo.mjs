import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { randomUUID, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  mkdir,
  rename,
  writeFile,
  readFile,
  symlink,
  access,
} from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
// Reuse the trusted system FFmpeg without downloading a second browser toolchain.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve(
  root,
  ".cache/submission-browsers",
);
const registry = JSON.parse(
  await readFile(
    resolve(root, "node_modules/playwright-core/browsers.json"),
    "utf8",
  ),
);
const revision = registry.browsers.find((b) => b.name === "ffmpeg").revision;
const ffmpegDirectory = resolve(
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  `ffmpeg-${revision}`,
);
await mkdir(ffmpegDirectory, { recursive: true });
const ffmpegLink = resolve(ffmpegDirectory, "ffmpeg-linux");
try {
  await access(ffmpegLink);
} catch {
  await symlink("/usr/bin/ffmpeg", ffmpegLink);
}
const { chromium } = await import("@playwright/test");
loadEnvFile(resolve(root, ".env"));
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Dedicated TEST_DATABASE_URL ending _test required.");
const require = createRequire(resolve(root, "server/package.json"));
const { Pool } = require("pg");
const { hash } = require("argon2");
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});
const schema = "tu_record_" + randomUUID().replaceAll("-", "");
const scoped = new URL(databaseUrl);
scoped.searchParams.set("options", `-c search_path=${schema}`);
const out = resolve(root, "docs/submission/tu");
await mkdir(resolve(out, "video"), { recursive: true });
await mkdir(resolve(out, "figures"), { recursive: true });
const apiBase = "http://127.0.0.1:3410";
let server, vite, browser, context;
const captures = [],
  phases = [];
let started, accessToken, createdBookId;
async function ready(url) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Recording server did not become ready.");
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((r) => child.once("exit", r)),
    new Promise((r) =>
      setTimeout(() => {
        child.kill("SIGKILL");
        r();
      }, 3000),
    ),
  ]);
}
function stamp(ms) {
  const t = Math.max(0, Math.floor(ms));
  return `${String(Math.floor(t / 3600000)).padStart(2, "0")}:${String(Math.floor(t / 60000) % 60).padStart(2, "0")}:${String(Math.floor(t / 1000) % 60).padStart(2, "0")},${String(t % 1000).padStart(3, "0")}`;
}
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  const env = {
    ...process.env,
    DATABASE_URL: scoped.toString(),
    PORT: "3410",
    HOST: "127.0.0.1",
    NODE_ENV: "test",
    ALLOWED_ORIGINS: "http://127.0.0.1:5410",
    JWT_SECRET: randomBytes(48).toString("hex"),
    LOG_LEVEL: "silent",
  };
  execFileSync(process.execPath, ["dist/db/migrate.js"], {
    cwd: resolve(root, "server"),
    env,
    stdio: "pipe",
  });
  const c = await pool.connect();
  try {
    await c.query(`SET search_path=${schema}`);
    await c.query(
      "INSERT INTO users(full_name,email,password_hash,role) VALUES ('Demo Librarian','staff@demo.test',$1,'LIBRARIAN')",
      [await hash("Demo-Catalog-Only-2026")],
    );
    const category = (
      await c.query(
        "INSERT INTO categories(name,slug) VALUES ('Technology','technology') RETURNING id",
      )
    ).rows[0].id;
    for (const title of [
      "Practical Web Foundations",
      "Transactions Made Clear",
    ])
      await c.query(
        "INSERT INTO books(category_id,title,author,description) VALUES($1,$2,'BookFlow Demo Team','Synthetic data in an isolated test schema.')",
        [category, title],
      );
  } finally {
    c.release();
  }
  server = spawn(process.execPath, ["dist/server.js"], {
    cwd: resolve(root, "server"),
    env,
    stdio: "ignore",
  });
  vite = spawn(
    process.execPath,
    [
      resolve(root, "client/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5410",
      "--strictPort",
    ],
    { cwd: resolve(root, "client"), stdio: "ignore" },
  );
  await Promise.all([
    ready(apiBase + "/health/ready"),
    ready("http://127.0.0.1:5410"),
  ]);
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    headless: true,
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: resolve(out, "video/raw"),
      size: { width: 1280, height: 900 },
    },
  });
  const page = await context.newPage();
  started = Date.now();
  const phase = async (text, delay = 1800) => {
    phases.push({ ms: Date.now() - started, text });
    await page.waitForTimeout(delay);
  };
  await page.route("**/api/v1**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: apiBase + url.pathname + url.search,
    });
    captures.push({
      method: route.request().method(),
      path: url.pathname,
      status: response.status(),
      ...(response.headers()["etag"]
        ? { etag: response.headers()["etag"] }
        : {}),
    });
    if (url.pathname.endsWith("/auth/login") && response.status() === 200)
      accessToken = (await response.json()).data.accessToken;
    if (
      url.pathname === "/api/v1/books" &&
      route.request().method() === "POST" &&
      response.status() === 201
    )
      createdBookId = (await response.json()).data.id;
    await route.fulfill({ response });
  });
  await page.goto("http://127.0.0.1:5410");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page.getByText("2 books found").waitFor();
  await phase(
    "Silent practice clip - record your own English narration. Public catalog uses real API data.",
    3500,
  );
  await page
    .locator("#main-content")
    .screenshot({ path: resolve(out, "figures/public-catalog.png") });
  await page.getByLabel("Search books").fill("Practical");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText("1 books found").waitFor();
  await phase(
    "Search, category filters and sorting are sent to the API. Pagination is bounded on the server.",
    3000,
  );
  await page.getByText("Staff sign in to manage the catalog").click();
  await page.getByLabel("Email", { exact: true }).fill("staff@demo.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Demo-Catalog-Only-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Add book", exact: true }).waitFor();
  await phase(
    "Staff authentication enables management. JWT and live database role checks protect the API.",
    3000,
  );
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Web Engineering");
  await page
    .getByLabel("Category slug", { exact: true })
    .fill("web-engineering");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Web Engineering", exact: true })
    .waitFor();
  await phase(
    "POST creates a category. Names and slugs are validated and unique.",
    3000,
  );
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  const form = page.getByRole("form", { name: "Add book", exact: true });
  await form.scrollIntoViewIfNeeded();
  await form.getByLabel("Title", { exact: true }).fill("REST API Design");
  await form.getByLabel("Author", { exact: true }).fill("Demo Author");
  await form
    .getByLabel("Book category")
    .selectOption({ label: "Web Engineering" });
  await form
    .getByLabel("Description", { exact: true })
    .fill("A synthetic book created through the real Catalog form.");
  await phase(
    "POST /books accepts the complete metadata and returns 201, Location and ETag.",
    2500,
  );
  await form.getByRole("button", { name: "Create book", exact: true }).click();
  await page
    .getByRole("heading", { name: "REST API Design", level: 3 })
    .waitFor();
  await page.getByLabel("New copy barcode").fill("COPY-DEMO-001");
  await page.getByRole("button", { name: "Add copy", exact: true }).click();
  await page.getByText("1 copies available").waitFor();
  await phase(
    "A book title and its physical copies are separate resources. New copies start AVAILABLE.",
    3000,
  );
  await page
    .getByLabel("Condition for COPY-DEMO-001")
    .selectOption("MAINTENANCE");
  await page.getByText("0 copies available").waitFor();
  await phase(
    "Availability is computed from condition and open loans. Metadata ETags do not cache availability.",
    3500,
  );
  await page
    .getByLabel("Condition for COPY-DEMO-001")
    .selectOption("AVAILABLE");
  await page.getByText("1 copies available").waitFor();
  await page
    .getByLabel("Physical copies")
    .screenshot({ path: resolve(out, "figures/physical-copies.png") });
  await page.getByLabel("New copy barcode").fill("COPY-DEMO-001");
  await page.getByRole("button", { name: "Add copy", exact: true }).click();
  await page.getByLabel("Physical copies").getByRole("alert").waitFor();
  await phase(
    "Duplicate barcode returns 409. The error is visible and existing data is preserved.",
    4000,
  );
  await page.getByRole("button", { name: "Edit book", exact: true }).click();
  let edit = page.getByRole("form", { name: "Edit book", exact: true });
  await edit
    .getByLabel("Title", { exact: true })
    .fill("REST API Design - Revised");
  await edit.getByRole("button", { name: "Save book", exact: true }).click();
  await page
    .getByRole("heading", { name: "REST API Design - Revised", level: 3 })
    .waitFor();
  await phase(
    "PUT replaces all editable metadata using If-Match. A successful save increments the version.",
    3000,
  );
  await page.getByRole("button", { name: "Edit book", exact: true }).click();
  edit = page.getByRole("form", { name: "Edit book", exact: true });
  await edit.getByLabel("Title", { exact: true }).fill("This edit is stale");
  const get = await fetch(apiBase + "/api/v1/books/" + createdBookId, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const update = await fetch(apiBase + "/api/v1/books/" + createdBookId, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "If-Match": get.headers.get("etag"),
    },
    body: JSON.stringify({ title: "REST API Design - Concurrent edit" }),
  });
  if (update.status !== 200) throw new Error("Concurrent edit failed");
  await edit.getByRole("button", { name: "Save book", exact: true }).click();
  await edit.getByRole("alert").waitFor();
  await edit.scrollIntoViewIfNeeded();
  await phase(
    "Another request changed the book. The stale form receives 412 and must reload before saving.",
    4500,
  );
  await edit.screenshot({ path: resolve(out, "figures/stale-version.png") });
  await page.getByRole("button", { name: "Reload book", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "REST API Design - Concurrent edit",
      level: 3,
    })
    .waitFor();
  await page
    .getByRole("form", { name: "Edit book", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Archive book", exact: true }).click();
  await phase(
    "DELETE archives the book instead of deleting its history. Open loans would block this operation.",
    2500,
  );
  await page
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await page
    .getByLabel("Book details")
    .getByText("Archived", { exact: true })
    .waitFor();
  await phase(
    "Archived metadata stays visible to staff and disappears from the public catalog.",
    3000,
  );
  await page
    .getByRole("button", { name: "Delete Web Engineering", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await page.getByLabel("Manage categories").getByRole("alert").waitFor();
  await phase(
    "A referenced category cannot be deleted, even when its book is archived. The API returns 409.",
    4000,
  );
  await phase(
    "End of practice footage. Add your own English explanation and combine with the other team members.",
    4000,
  );
  const video = page.video();
  await context.close();
  context = undefined;
  const raw = await video.path();
  await rename(raw, resolve(out, "video/tu-catalog-practice.webm"));
  const end = Date.now() - started;
  const srt = phases
    .map(
      (p, i) =>
        `${i + 1}\n${stamp(p.ms)} --> ${stamp((phases[i + 1]?.ms ?? end) - 100)}\n${p.text}\n`,
    )
    .join("\n");
  await writeFile(resolve(out, "video/tu-catalog-practice.srt"), srt);
  await writeFile(
    resolve(out, "logs/recording-http.json"),
    JSON.stringify(
      {
        scope:
          "Real browser/API actions in an isolated test schema; not production or CI",
        requests: captures,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Saved real practice footage, captions, figures and credential-free HTTP metadata.",
  );
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await stop(server);
  await stop(vite);
  try {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } finally {
    await pool.end();
  }
}
