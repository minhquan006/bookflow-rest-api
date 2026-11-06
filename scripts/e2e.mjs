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
const projectOnly =
  (args.length === 1 && args[0].startsWith("--project=")) ||
  (args.length === 2 && args[0] === "--project");
const fullManagedSuite =
  !process.env.E2E_EXTERNAL && (args.length === 0 || projectOnly);
const runs =
  process.env.E2E_EXTERNAL || selected
    ? [{ args, project: "external-or-selected" }]
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
