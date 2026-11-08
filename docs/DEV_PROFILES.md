# Development configuration

Use Node 24.19.0 and npm 11. The [root README](../README.md) provides the full
installation sequence. This guide covers alternate ports, configuration updates,
browser tests and troubleshooting.

## Ports and environment files

| Setting                       | Default profile | Alternate Mac profile |
| ----------------------------- | --------------- | --------------------- |
| `HOST`                        | `127.0.0.1`     | `127.0.0.1`           |
| `PORT` (API)                  | `3000`          | `3100`                |
| `WEB_PORT` (Vite)             | `5173`          | `5174`                |
| `POSTGRES_PORT` (host)        | `5432`          | `5433`                |
| Port in both database URLs    | `5432`          | `5433`                |
| Web port in `ALLOWED_ORIGINS` | `5173`          | `5174`                |

For a fresh checkout, choose `npm run setup` or `npm run setup:mac` before the
first database start. Both preserve existing local files; running a different
setup command does not switch an existing installation's ports or passwords.

Root `.env` configures Compose, the development launcher, Vite and Playwright.
A standalone server reads `server/.env`. Process environment values override
file settings. Client `.env.local` holds public browser settings only.

To change an existing profile:

1. Stop BookFlow API/client processes with Ctrl+C in their terminals.
2. Preserve database passwords and signing settings. Update `PORT`, `WEB_PORT`,
   `POSTGRES_PORT`, both database URLs and `ALLOWED_ORIGINS` consistently in root
   and server configuration where applicable.
3. If the database host port changed, recreate the DB container using
   `docker compose up -d --wait db`. Keep the existing data volume.
4. Restart the application and verify `/api/v1`, `/health/ready`, `/docs/` and
   `/openapi.yaml` through the web origin on the selected port.

The launcher rejects occupied ports, and Vite uses a strict port. It stops only
child processes it created. Wildcard API bind addresses are converted to loopback
for the development proxy target. Do not terminate an unrelated application to
make its port available.

Existing PostgreSQL volumes retain their original credentials. Editing `.env`
does not change those credentials. `docker compose down` retains the volume;
`docker compose down -v` removes it and its data.

## Docker configuration

Inside Compose, the API connects to `db:5432`, listens internally on port 3000,
and is reached through Nginx on host port 8080. Native development port settings
do not change that deployment's API/web ports. Database port publication uses
`POSTGRES_PORT` on loopback.

If a development network requires a custom proxy CA, the Compose wrapper mounts
the configured CA as a BuildKit secret:

```bash
npm run compose -- build api web
```

Keep TLS verification enabled. Do not copy credentials or a private environment
file into an image.

## Browser tests

Prepare the database and browser with the root README commands. Stop manually
started BookFlow API/client processes before a managed run; keep the database
running. The Playwright configuration can reuse an existing server locally,
which would retain that server's configuration and request budget.

```bash
npm run test:e2e -- --retries=0
npm run test:e2e -- --project=chromium --retries=0
npm run test:e2e -- --project=mobile --retries=0 --reporter=list,html
```

A full managed run splits each project into UI and session batches, starting a
fresh API for each batch. Execution options such as retries and reporters retain
this split. An explicit file/grep filter or external mode retains the selected
scope instead. This isolates request budgets without removing application rate
limits or assertions.

HTML report locations for full managed runs are:

- `playwright-report/chromium-ui/index.html`
- `playwright-report/chromium-sessions/index.html`
- `playwright-report/mobile-ui/index.html`
- `playwright-report/mobile-sessions/index.html`

A reporter that replaces HTML, such as `--reporter=line`, does not produce an HTML
report. Include `html` when it is needed. Mobile uses Chromium device emulation.

Install Chromium with `npx playwright install chromium`; Linux may require
`npx playwright install --with-deps chromium`. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use a specific executable. The configuration
also detects `/usr/bin/chromium` when present.

Authentication defaults to 10 requests per IP/account in 15 minutes for each
login/register endpoint. Managed E2E API processes use `AUTH_RATE_LIMIT_MAX=100`
for repeated browser contexts. Reused servers retain their original settings.
Do not bypass a rate-limit failure by removing the limit or treating HTTP 429 as success.

## Testing an existing stack

External mode starts and stops no servers. Its database connection and seed
password must match the stack being tested. Catalog fixtures create 13 synthetic
books and remove only their own rows; use an authorized local/test database.

Bash/zsh example:

```bash
E2E_EXTERNAL=1 E2E_BASE_URL=http://127.0.0.1:5174 npm run test:e2e -- --retries=0
SMOKE_BASE_URL=http://127.0.0.1:5174 npm run smoke
```

PowerShell example:

```powershell
$env:E2E_EXTERNAL = "1"
$env:E2E_BASE_URL = "http://127.0.0.1:5174"
npm.cmd run test:e2e -- --retries=0
Remove-Item Env:E2E_EXTERNAL, Env:E2E_BASE_URL
$env:SMOKE_BASE_URL = "http://127.0.0.1:5174"
npm.cmd run smoke
Remove-Item Env:SMOKE_BASE_URL
```

Use port 5173 for the default development profile or 8080 for Docker. Smoke uses
8080 if `SMOKE_BASE_URL` is not set.

## Troubleshooting

| Symptom                                | Check                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Port already in use                    | Stop the previous BookFlow process or select unused ports.                                        |
| Database connection refused            | Check `docker compose ps`, host port and both database URLs.                                      |
| Password rejected after editing `.env` | Restore settings matching the existing volume; a file edit does not rotate the database password. |
| Readiness returns 503                  | Build the API, apply migrations and check database/schema readiness.                              |
| Seeded account cannot sign in          | Use its originally seeded password; seeding again preserves existing credentials.                 |
| Refresh/logout rejected                | Match `ALLOWED_ORIGINS` and use one consistent hostname and port.                                 |
| HTTP 429 during repeated tests         | Stop reused test servers and use managed batches with fresh API processes.                        |
| Browser missing                        | Install Chromium or set its executable path.                                                      |
