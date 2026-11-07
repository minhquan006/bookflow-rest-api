# BookFlow documentation

Start with the [root README](../README.md) to install and run the application.
This directory contains current guides, the API contract and validation records.
Historical plans and module reviews are grouped in [archive](archive/README.md).

## Guides

| Document                                     | Purpose                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| [Development configuration](DEV_PROFILES.md) | Ports, environment files, browser testing and troubleshooting |
| [Frontend](../client/README.md)              | Client structure, requests and viewer state                   |
| [Backend](../server/README.md)               | API structure, configuration and validation                   |
| [API contract](API_CONTRACT.md)              | Request/response rules, access, preconditions and errors      |
| [OpenAPI](openapi.yaml)                      | Machine-readable contract served by Swagger                   |
| [Migrations](../server/migrations/README.md) | Schema changes, checksum validation and transaction rules     |
| [Postman](../postman/README.md)              | API smoke, catalog and business collections                   |
| [Languages](LANGUAGES.md)                    | Translation coverage and maintenance rules                    |
| [Contributing](../CONTRIBUTING.md)           | Coding conventions, checks and PR workflow                    |

## Project and validation

| Document                                          | Purpose                                                    |
| ------------------------------------------------- | ---------------------------------------------------------- |
| [System design](PROJECT_BLUEPRINT.md)             | Design boundaries and consistency decisions                |
| [Implementation status](IMPLEMENTATION_STATUS.md) | Delivered scope and integration baseline                   |
| [Source validation](SOURCE_FINALIZATION.md)       | Final recorded commands, results and limits                |
| [Evidence index](evidence/README.md)              | Versioned summaries, screenshots and reproduction material |
| [Benchmark](BENCHMARK.md)                         | Historical local measurements and their limits             |
| [Team handoff](TEAM_HANDOFF.md)                   | Responsibilities and release coordination                  |
| [Requirements](REQUIREMENTS_TRACEABILITY.md)      | Mapping to the academic assignment                         |
| [Submission guide](SUBMISSION_GUIDE.md)           | Required deliverables and final upload checks              |
| [Tool assistance](AI_ASSISTANCE.md)               | Assistance and responsibility statement                    |

## Architecture

```text
Browser (React) / Postman
          |
          | HTTP; Vite proxy in development, Nginx in Docker
          v
Express routes and shared middleware
          |
Services and transaction boundaries
          |
Repositories using parameterized SQL
          |
PostgreSQL
```

`client/src/App.tsx` composes language and authentication providers. `app/`
contains routing, the shared layout and browser-history handling. `features/`
contains home, auth, catalog, loans, users and administration. Shared components,
HTTP/error/date helpers and translations live outside individual features.

`server/src/server.ts` starts the API; `app.ts` composes Express middleware;
`routes.ts` registers modules. Books, categories and copies are grouped by the
catalog router. Authentication, users, loans and administration have their own
routes, schemas, services and repositories. `src/db/` supplies the shared pool
and transaction helper.

Routes select HTTP behavior; services enforce business rules and transaction
boundaries; repositories use the supplied client. Backend authorization and
ownership checks remain mandatory even when the UI restricts navigation.

## Reading historical records

Archived documents retain the commit, date and environment in which work was
planned or checked. Their pending items and test counts may predate later fixes.
Use the current status and source validation pages for the integrated baseline.
The archive is supporting evidence, not an additional installation guide.
