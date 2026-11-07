import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const cli = require.resolve("@playwright/test/cli");
const args = process.argv.slice(2);
const selected = args.some(
  (arg) => arg === "--project" || arg.startsWith("--project="),
);
// Managed runs own their server lifetimes. Keep both projects and the full
// suite's UI/session groups on fresh APIs: the combined flows exceed the real
// 300/minute IP budget. External and custom filtered runs retain their scope.
// These options change execution/reporting, not which test files are selected.
// Consume separate values so e.g. "--reporter line" is not a file filter.
// Unknown options and explicit filters keep the original CLI invocation intact.
const valueOptions = new Set([
  "--project",
  "--retries",
  "--reporter",
  "--add-reporter",
  "--workers",
  "-j",
  "--timeout",
  "--global-timeout",
  "--max-failures",
  "--repeat-each",
  "--trace",
  "--output",
  "--tsconfig",
]);
const flagOptions = new Set([
  "--headed",
  "--forbid-only",
  "--fully-parallel",
  "--quiet",
  "--fail-on-flaky-tests",
  "--ignore-snapshots",
  "--no-deps",
  "--list",
  "-x",
]);
let fullManagedSuite = !process.env.E2E_EXTERNAL;
const projects = [];
for (let index = 0; fullManagedSuite && index < args.length; index++) {
  const argument = args[index];
  const equals = argument.indexOf("=");
  const option = equals < 0 ? argument : argument.slice(0, equals);
  if (valueOptions.has(option)) {
    const value = equals < 0 ? args[++index] : argument.slice(equals + 1);
    if (!value || value.startsWith("-")) fullManagedSuite = false;
    else if (option === "--project") projects.push(value);
  } else if (!flagOptions.has(argument)) fullManagedSuite = false;
}
const selectedLabel =
  projects.length === 1
    ? projects[0].replace(/[^a-zA-Z0-9_.-]/g, "_")
    : "external-or-selected";
const runs =
  process.env.E2E_EXTERNAL || selected
    ? [{ args, project: selectedLabel }]
    : ["chromium", "mobile"].map((project) => ({
        args: [...args, `--project=${project}`],
        project,
      }));
const sessionFiles = new Set([
  "session-tabs.spec.ts",
  "loan-return-session.spec.ts",
]);
const files = fullManagedSuite
  ? readdirSync(resolve(import.meta.dirname, "../tests/e2e"))
      .filter((name) => name.endsWith(".spec.ts"))
      .sort()
  : [];
const batches = fullManagedSuite
  ? runs.flatMap((run) =>
      ["ui", "sessions"].map((group) => ({
        args: [
          ...run.args,
          ...files
            .filter((name) => sessionFiles.has(name) === (group === "sessions"))
            .map((name) => `tests/e2e/${name}`),
        ],
        project: `${run.project}-${group}`,
      })),
    )
  : runs;
for (const run of batches) {
  const result = spawnSync(process.execPath, [cli, "test", ...run.args], {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_HTML_OUTPUT_DIR: `playwright-report/${run.project}`,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
