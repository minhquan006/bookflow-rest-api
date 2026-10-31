# Development profiles

Use Node 24.19.0/npm 11. Root `.env` configures dev, Vite and Playwright.
Process variables override root values. No private setting belongs in `VITE_*`.

| Setting                  | Default   | Quân's Mac profile |
| ------------------------ | --------- | ------------------ |
| HOST                     | 127.0.0.1 | 127.0.0.1          |
| PORT (API)               | 3000      | 3100               |
| WEB_PORT (strict Vite)   | 5173      | 5174               |
| POSTGRES_PORT (host)     | 5432      | 5433               |
| Both database URL ports  | 5432      | 5433               |
| ALLOWED_ORIGINS web port | 5173      | 5174               |

Fresh setup: `npm run setup` or `npm run setup:mac`. Both preserve existing
local files. To switch an existing profile, retain passwords and update ports,
both DB URLs and allowed origins consistently in root/server `.env`.
Test DB names end `_test`. Never print or commit local env files.

Follow [README](../README.md) to start DB, build, migrate, seed and create test DB.
Existing volumes retain data/passwords; never use `docker compose down -v`.
Docker DB connections remain `db:5432`. All-container API stays internal 3000,
Nginx web 8080; these settings configure native dev, not that deployment.

Dev refuses occupied ports; Vite uses strict port. Ctrl+C stops launcher-owned
children. Do not stop unrelated applications or reuse another application's port.
Check the web origin on 5173 (or 5174): `/api/v1` must identify BookFlow API;
`/health/ready` must be ready; `/docs/` and `/openapi.yaml` must serve the contract.
All four paths proxy to the same API using HOST/PORT. Wildcard API bind addresses
use loopback as the proxy target. Root/server env must agree for a standalone API.

`npm run test:e2e` runs managed desktop/mobile projects with separate server
lifetimes. Reports are in `playwright-report/chromium` and `playwright-report/mobile`.
An explicit project is run alone. Stop manually started BookFlow dev first with
Ctrl+C in its own terminal; keep DB running. Do not disable rate limits for tests.

For an existing stack in PowerShell, set `$env:E2E_EXTERNAL="1"` and
`$env:E2E_BASE_URL="http://127.0.0.1:5174"` before `npm.cmd run test:e2e`.
External mode never starts/stops servers. DB URL and seed password must match
that stack: Catalog fixtures insert 13 synthetic books and remove only their rows.
Set `$env:SMOKE_BASE_URL` to the web origin for smoke. Remove temporary variables
afterwards. Without an override, all-container smoke targets web 8080.
Linux checks using Mac port numbers do not prove macOS hardware compatibility.
