import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cli = require.resolve("@playwright/test/cli");
const args = process.argv.slice(2);
const selected = args.some(
  (arg) => arg === "--project" || arg.startsWith("--project="),
);
// Managed projects own their server lifetimes. Isolate desktop/mobile runs so
// shared IP/account rate-limit stores and fixture traffic do not leak between
// browser projects. External servers are never restarted by this launcher.
const runs =
  process.env.E2E_EXTERNAL || selected
    ? [{ args, project: "external-or-selected" }]
    : ["chromium", "mobile"].map((project) => ({
        args: [...args, `--project=${project}`],
        project,
      }));
for (const run of runs) {
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
