import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const uiFile = "tests/e2e/catalog.spec.ts";
const sessions = [
  "tests/e2e/loan-return-session.spec.ts",
  "tests/e2e/session-tabs.spec.ts",
];

// Exercise the real launcher in a child process. The temporary CLI records each
// invocation, so these regressions verify API lifecycle boundaries without a DB.
function run(args, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "bookflow-e2e-runner-"));
  try {
    for (const directory of [
      "scripts",
      "tests/e2e",
      "node_modules/@playwright/test",
    ])
      mkdirSync(join(root, directory), { recursive: true });
    copyFileSync(
      new URL("./e2e.mjs", import.meta.url),
      join(root, "scripts/e2e.mjs"),
    );
    for (const name of [uiFile, ...sessions])
      writeFileSync(join(root, name), "");
    writeFileSync(
      join(root, "node_modules/@playwright/test/package.json"),
      JSON.stringify({ exports: { "./cli": "./cli.cjs" } }),
    );
    writeFileSync(
      join(root, "node_modules/@playwright/test/cli.cjs"),
      `const fs = require("node:fs");
const log = process.env.RUNNER_FIXTURE_LOG;
const first = !fs.existsSync(log);
fs.appendFileSync(log, JSON.stringify({
  args: process.argv.slice(2),
  report: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR,
}) + "\\n");
if (first && process.env.RUNNER_FIXTURE_FAIL_FIRST) process.exit(17);
`,
    );
    const log = join(root, "calls.jsonl");
    const env = { ...process.env, RUNNER_FIXTURE_LOG: log, ...overrides };
    if (!Object.hasOwn(overrides, "E2E_EXTERNAL")) delete env.E2E_EXTERNAL;
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/e2e.mjs"), ...args],
      {
        cwd: root,
        env,
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.ifError(result.error);
    const calls = existsSync(log)
      ? readFileSync(log, "utf8").trim().split("\n").map(JSON.parse)
      : [];
    return { ...result, calls };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function expectGroups(calls, options) {
  assert.equal(
    calls.length,
    2,
    "full project uses separate UI/session processes",
  );
  assert.deepEqual(calls[0].args, ["test", ...options, uiFile]);
  assert.deepEqual(calls[1].args, ["test", ...options, ...sessions]);
  assert.notEqual(calls[0].report, calls[1].report);
}

test("default managed run separates both projects and all UI/session files", () => {
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 4);
  expectGroups(result.calls.slice(0, 2), ["--project=chromium"]);
  expectGroups(result.calls.slice(2), ["--project=mobile"]);
});

for (const options of [
  ["--project=chromium", "--retries=0"],
  ["--project", "chromium", "--retries", "0", "--reporter", "line"],
  ["--reporter=line,html", "--retries=0", "--project=mobile"],
]) {
  test(`execution flags preserve full-project batches: ${options.join(" ")}`, () => {
    const result = run(options);
    assert.equal(result.status, 0, result.stderr);
    expectGroups(result.calls, options);
  });
}

test("retries/reporter without project preserve four managed batches", () => {
  const options = ["--retries=0", "--reporter=line"];
  const result = run(options);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 4);
  expectGroups(result.calls.slice(0, 2), [...options, "--project=chromium"]);
  expectGroups(result.calls.slice(2), [...options, "--project=mobile"]);
});

test("selected project reports do not overwrite the other project's reports", () => {
  const chromium = run(["--project=chromium"]);
  const mobile = run(["--project=mobile"]);
  assert.deepEqual(
    chromium.calls.map((call) => call.report),
    ["playwright-report/chromium-ui", "playwright-report/chromium-sessions"],
  );
  assert.deepEqual(
    mobile.calls.map((call) => call.report),
    ["playwright-report/mobile-ui", "playwright-report/mobile-sessions"],
  );
});

for (const options of [
  [uiFile, "--project=chromium", "--retries=0"],
  ["--project=chromium", "--grep", "specific flow", "--reporter=line"],
]) {
  test(`explicit filters keep their original scope: ${options.join(" ")}`, () => {
    const result = run(options);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      result.calls.map((call) => call.args),
      [["test", ...options]],
    );
  });
}

test("external mode forwards flags once without adding files or projects", () => {
  const options = ["--retries=0", "--reporter=line"];
  const result = run(options, { E2E_EXTERNAL: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call.args),
    [["test", ...options]],
  );
});

test("a failed batch stops the runner and preserves the CLI exit code", () => {
  const result = run(["--project=chromium", "--retries=0"], {
    RUNNER_FIXTURE_FAIL_FIRST: "1",
  });
  assert.equal(result.status, 17);
  assert.equal(result.calls.length, 1);
});
