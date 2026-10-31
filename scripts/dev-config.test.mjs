import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readDevConfig, repositoryRoot } from "./dev-config.ts";

for (const [label, api, web] of [
  ["default", 3000, 5173],
  ["Mac ports", 3100, 5174],
]) {
  test(`shared development settings: ${label}`, () => {
    const config = readDevConfig({
      PORT: String(api),
      WEB_PORT: String(web),
      HOST: "127.0.0.1",
    });
    assert.equal(config.apiOrigin, `http://127.0.0.1:${api}`);
    assert.equal(config.webOrigin, `http://127.0.0.1:${web}`);
  });
}
test("rejects invalid/colliding ports and handles wildcard bind", () => {
  for (const PORT of ["0", "65536", "no", "3100oops"])
    assert.throws(() => readDevConfig({ PORT }), /PORT must/);
  assert.throws(
    () => readDevConfig({ PORT: "3100", WEB_PORT: "3100" }),
    /different/,
  );
  assert.equal(
    readDevConfig({ HOST: "0.0.0.0", PORT: "3100" }).apiOrigin,
    "http://127.0.0.1:3100",
  );
});
test("dev refuses an occupied port without stopping its owner", async () => {
  const existing = createServer();
  existing.listen(0, "127.0.0.1");
  await once(existing, "listening");
  const port = existing.address().port;
  try {
    const child = spawn(process.execPath, ["scripts/dev.mjs"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        WEB_PORT: port === 5173 ? "5174" : "5173",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stderr.on("data", (data) => {
      output += data;
    });
    const [code] = await once(child, "exit");
    assert.notEqual(code, 0);
    assert.match(output, /existing services were left running/);
    assert.equal(existing.listening, true);
  } finally {
    await new Promise((resolve) => existing.close(resolve));
  }
});

test("Mac setup creates consistent local settings and preserves them on rerun", () => {
  const root = mkdtempSync(join(tmpdir(), "bookflow-setup-"));
  try {
    for (const dir of ["scripts", "server", "client"])
      mkdirSync(join(root, dir));
    copyFileSync(
      join(repositoryRoot, "scripts/init-env.mjs"),
      join(root, "scripts/init-env.mjs"),
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [join(root, "scripts/init-env.mjs"), "--mac"],
        { encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    const original = readFileSync(join(root, ".env"));
    const env = parseEnv(original.toString());
    assert.equal(env.PORT, "3100");
    assert.equal(env.WEB_PORT, "5174");
    assert.equal(env.POSTGRES_PORT, "5433");
    assert.equal(new URL(env.DATABASE_URL).port, "5433");
    assert.equal(
      new URL(env.TEST_DATABASE_URL).pathname.endsWith("_test"),
      true,
    );
    assert.ok(
      original.equals(readFileSync(join(root, "server/.env"))),
      "root/server settings match",
    );
    assert.equal(run().status, 0);
    assert.ok(
      original.equals(readFileSync(join(root, ".env"))),
      "existing credentials/config preserved",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
