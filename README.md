# BookFlow

BookFlow is a library management web application built with React, Express and
PostgreSQL. Members browse the catalog and borrow books, librarians manage the
collection and confirm returns, and administrators manage users and audit records.

The project was developed for **Web Programming & Applications (503073)** at
Ton Duc Thang University, with RESTful Web Services as its technical focus.

## Features

- Public catalog with search, category filters, sorting and pagination.
- Book, category and physical-copy management, with availability and archival.
- Registration, login, role-based access and account status management.
- Member borrowing with loan limits, overdue checks and concurrent allocation protection.
- Staff return confirmation that preserves the original result on repeated requests.
- Staff dashboard and administrator audit viewer.
- English and Vietnamese interfaces, persistent language preference and URL-based catalog state.
- OpenAPI/Swagger documentation, Postman collections, automated tests and Docker deployment.

The API uses signed access tokens, rotating refresh sessions, CSRF protection,
ETag-based reads and version preconditions for book edits. See the
[API contract](docs/API_CONTRACT.md) for resource behavior and error responses.

## Requirements

| Tool       | Version                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| Node.js    | 24.19.0, as specified in `.nvmrc`                                            |
| npm        | 11.x                                                                         |
| PostgreSQL | 17; the supplied Compose configuration uses 17.6                             |
| Docker     | Engine/Desktop with Compose v2, if using the supplied database or full stack |

The root, `server` and `client` packages have separate lockfiles. Use the commands
below to install all three consistently.

## Quick start

```bash
git clone https://github.com/minhquan006/bookflow-rest-api.git
cd bookflow-rest-api
npm ci
npm run deps
npm run setup
docker compose up -d --wait db
npm --prefix server run build
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Swagger is available at
[http://127.0.0.1:5173/docs/](http://127.0.0.1:5173/docs/).

`npm run setup` creates missing `.env`, `server/.env` and `client/.env.local`
files with random local credentials. It preserves existing files. Read the local
`SEED_DEMO_PASSWORD` value privately to sign in with a seeded account:

| Account                   | Role      | Access                                                                |
| ------------------------- | --------- | --------------------------------------------------------------------- |
| `member@bookflow.test`    | MEMBER    | Browse, borrow and view own loans                                     |
| `librarian@bookflow.test` | LIBRARIAN | Manage catalog/copies, view loans, confirm returns and view dashboard |
| `admin@bookflow.test`     | ADMIN     | Staff functions, user management and audit records                    |

Seeding preserves existing passwords and records. Registration creates a MEMBER;
staff accounts do not borrow on behalf of members.

Default ports are **5432** for PostgreSQL, **3000** for the API and **5173** for
Vite. If these are occupied, see [development profiles](docs/DEV_PROFILES.md).
A fresh `npm run setup:mac` uses ports 5433, 3100 and 5174 instead.

If PostgreSQL is already installed, configure `DATABASE_URL` and
`TEST_DATABASE_URL` and skip the Docker database command. Commands are run from
the repository root and also work in PowerShell/CMD without sourcing `.env`.

## Docker deployment

Install root dependencies with `npm ci` if not already installed, then run:

```bash
npm run setup
docker compose up -d --wait db
docker compose build api web
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:seed
docker compose up -d --wait api web
npm run smoke
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). Nginx serves the client and
proxies API, health and documentation paths. The API is internal to the Compose
network; the web and database ports are bound to loopback. API and web containers
run as non-root users.

Stop the stack with `docker compose down`; the database volume is retained.
`docker compose down -v` deletes that data. Rebuild images and apply migrations
when deploying changed source. For a network requiring a custom proxy CA, use
`npm run compose -- build api web`; see [development profiles](docs/DEV_PROFILES.md).

## Configuration

| File                                                         | Purpose                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `.env`                                                       | Compose settings and shared development configuration                 |
| `server/.env`                                                | API, database, authentication and seed settings                       |
| `client/.env.local`                                          | Public browser configuration; defaults to `VITE_API_BASE_URL=/api/v1` |
| `.env.example`, `server/.env.example`, `client/.env.example` | Configuration keys without real credentials                           |

Keep root and server configuration consistent, especially database URLs, signing
settings and allowed origins. Environment variables set by the process take
precedence. Changing a file does not change the credentials in an existing
PostgreSQL volume. Restart affected processes after changing configuration.
Never put secrets in `VITE_*` variables; their values are public browser code.

## Tests and checks

Prepare a dedicated test database and the Playwright browser before the first
integration/browser run:

```bash
npm run db:test:create
npx playwright install chromium
```

The configured test database name must end in `_test`. Its user needs database
creation permission for the helper, or the database must be provisioned separately.

| Command                           | Purpose                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `npm run check`                   | Lint, type checks, builds, tooling/application tests, API contract and formatting |
| `npm run test:integration`        | PostgreSQL integration suites using isolated test schemas                         |
| `npm run test:e2e -- --retries=0` | Managed desktop and mobile browser flows without retries                          |
| `npm run smoke`                   | Health, documentation and HTTP error checks against a running Docker web stack    |
| `npm run benchmark`               | Local database benchmark; requires a server build and `TEST_DATABASE_URL`         |

Stop manually started BookFlow API/client processes before a managed E2E run;
keep PostgreSQL running. The runner starts fresh API processes for UI and session
batches. Mobile tests use Chromium device emulation. See
[development profiles](docs/DEV_PROFILES.md) for report paths, external-stack mode
and custom browser executables, and [Postman](postman/README.md) for API workflows.

Recorded results and their exact environments are in
[source validation](docs/SOURCE_FINALIZATION.md). These are versioned observations,
not a test coverage percentage or a guarantee about later changes.

## Repository layout

```text
client/       React application, styles and component tests
server/       Express API, SQL migrations and backend tests
scripts/      Setup, development, validation and test orchestration
tests/e2e/   Playwright browser workflows
postman/      API collections and an environment template
deploy/       Container images and Nginx configuration
docs/         API contract, guides, evidence and archived development records
```

## Documentation

- [Documentation index and architecture](docs/README.md)
- [Frontend guide](client/README.md) and [backend guide](server/README.md)
- [Development profiles and troubleshooting](docs/DEV_PROFILES.md)
- [API contract](docs/API_CONTRACT.md) and [OpenAPI specification](docs/openapi.yaml)
- [Database migrations](server/migrations/README.md)
- [Contribution guide](CONTRIBUTING.md) and [team handoff](docs/TEAM_HANDOFF.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md) and [submission guide](docs/SUBMISSION_GUIDE.md)

## Scope and limitations

The supplied Docker stack is a local demonstration deployment. Public hosting
would require HTTPS, production configuration, secret management, backups and
operational monitoring. Authentication requires browser Web Locks and writable
site storage on localhost or HTTPS.

Access JWTs are signed, not encrypted. Logout revokes refresh sessions; an issued
access token can remain valid until expiry. The API applies resource and HTTP
principles but does not implement complete REST hypermedia navigation.
Reservations, reminder emails and OAuth login are outside the current scope.

## Team

| Member           | Student ID | Main responsibility                               |
| ---------------- | ---------- | ------------------------------------------------- |
| Nguyễn Minh Quân | 52400227   | Authentication, users and integration             |
| Phạm Văn Tú      | 52400252   | Catalog, copies, frontend and development tooling |
| Lê Nguyễn Vạn An | 52400258   | Loans, dashboard, audit and API validation        |
