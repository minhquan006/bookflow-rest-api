# BookFlow Postman collections

These collections exercise the running API. Follow the [root setup guide](../README.md)
to start PostgreSQL, migrate, seed and run the application before using them.

| Collection                                  | Purpose                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `BookFlow.postman_collection.json`          | Health, readiness, API information, documentation and unknown-route smoke checks |
| `BookFlow.catalog.postman_collection.json`  | Catalog requests and checks                                                      |
| `BookFlow.business.postman_collection.json` | Ordered 20-request integrated business workflow                                  |

## Configure Postman

Import a collection and `BookFlow.local.postman_environment.json`. Set local
values in Postman; do not export or commit an environment containing credentials.

| Variable         | Value                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`        | Service origin without `/api/v1`: direct API `http://127.0.0.1:3000`, Vite `http://127.0.0.1:5173`, or Docker `http://127.0.0.1:8080` |
| `frontendOrigin` | An exact origin allowed by the API, usually the matching Vite or Docker web origin; no trailing slash                                 |
| `adminEmail`     | `admin@bookflow.test`                                                                                                                 |
| `adminPassword`  | The password originally seeded from local `SEED_DEMO_PASSWORD`                                                                        |

The alternate Mac profile uses API 3100 and web 5174. Vite proxies API,
documentation and health routes, so smoke checks can run through either the API
or web origin. Refresh/logout require the correct Origin and CSRF handling.
Runtime tokens, CSRF values, resource IDs and ETags are populated by collection
scripts; keep them out of shared environment files.

## Business workflow

Run the complete business collection in its 01–20 order. It creates a synthetic
member, signs in as admin, creates category/book/copy data, checks metadata and
conditional reads, rejects a stale edit, signs in and refreshes the member,
borrows a copy, checks history and permissions, confirms and repeats a staff
return, inspects dashboard/audit data, archives the book and logs out.

Postman's cookie jar manages HttpOnly refresh cookies. Collection scripts provide
CSRF and Origin headers. Running one request alone requires its prerequisite
IDs, tokens and ETag; it does not replace a successful full collection run.

Each run creates suffixed synthetic data and retains returned loans and audit
history. The collection does not purge the database. Use an authorized local/test
stack rather than production or personal data. Re-seeding does not change an
existing account's password.

## Newman and evidence

The collections can also run with Newman 6.x. Provide credentials through an
ignored local configuration file or an in-memory Node environment object; avoid
passwords in shell history and command output. Newman needs the same cookie and
Origin configuration as Postman.

A historical Docker/Nginx run recorded **20 requests, 33 assertions and zero
failures** in [postman.json](../docs/evidence/postman.json). That record retains
its execution time and endpoint mode. It was not rerun during the final source
validation and does not establish CI status for later commits.

Repeated sign-ins can reach the authentication rate limit. Use the documented
local/test configuration and restart affected test processes when needed; keep
rate-limit checks and assertions intact. See
[development configuration](../docs/DEV_PROFILES.md).
