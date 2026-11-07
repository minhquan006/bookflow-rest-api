# BookFlow API

The backend is an Express and TypeScript application backed by PostgreSQL 17.
It implements authentication, user management, catalog/copies, circulation,
staff dashboard and administrator audit access.

## Run locally

Use Node 24.19.0 and npm 11. Follow the [root setup guide](../README.md) to install
packages and configure PostgreSQL. Build the server before running database
commands, which execute compiled files:

```bash
npm --prefix server run build
npm run db:migrate
npm run db:seed
```

Use the root `npm run dev` to start both applications. To run only the API:

```bash
npm --prefix server run dev
```

A standalone API reads `server/.env`; keep it consistent with root `.env`.
`npm --prefix server start` runs the compiled server. Never commit local credentials.

## Structure

| Path                             | Responsibility                                              |
| -------------------------------- | ----------------------------------------------------------- |
| `src/server.ts`                  | Process startup, listener and graceful shutdown             |
| `src/app.ts`                     | Express setup and shared middleware                         |
| `src/routes.ts`                  | Module registration                                         |
| `src/routes.resources.ts`        | Resource and HTTP method registry                           |
| `src/modules/`                   | Route, schema, service and repository code by business area |
| `src/config/`                    | Validated environment configuration                         |
| `src/db/`                        | Pool, transaction helper, migration and seed entry points   |
| `src/middleware/`, `src/shared/` | Access checks, request context, errors and shared helpers   |
| `migrations/`                    | Ordered SQL migrations                                      |
| `tests/`                         | Unit, HTTP, contract and PostgreSQL integration tests       |

Routes handle HTTP. Services own business decisions and transactions.
Repositories use parameterized SQL on the supplied client. Every repository call
inside a transaction must use that same client.

## Configuration and data

`server/.env.example` lists the supported configuration keys. Setup creates
random local signing/database/demo values; it preserves existing environment
files. Seed inserts synthetic accounts and catalog data without overwriting
existing passwords. See [development profiles](../docs/DEV_PROFILES.md) before
changing a persistent database's configuration.

Migrations are a separate deployment step, not an API startup side effect.
Readiness returns 503 while the database or required schema is unavailable.
Add a new migration instead of editing one already merged; see the
[migration guide](migrations/README.md).

## Contract and validation

The contract is [OpenAPI](../docs/openapi.yaml), explained in
[API_CONTRACT](../docs/API_CONTRACT.md). Swagger is served at `/docs/`.
Update the resource registry, contract, relevant Postman requests and tests when
adding or changing an endpoint.

```bash
npm --prefix server run typecheck
npm --prefix server test
npm run db:test:create
npm run test:integration
npm run contract:check
```

Integration requires a dedicated `TEST_DATABASE_URL` whose database name ends in
`_test`. Suites create isolated schemas and drop only their own schema; they must
not reset the development database. The compressed-request subprocess regression
tests run without a database. Root `npm run check` remains required for source changes.
