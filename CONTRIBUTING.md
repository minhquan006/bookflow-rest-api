# Contributing to BookFlow

Read the [README](README.md), [architecture guide](docs/README.md),
[team handoff](docs/TEAM_HANDOFF.md) and relevant [API contract](docs/API_CONTRACT.md)
sections before changing the application.

## Local development

Use Node 24.19.0 and npm 11. Install with `npm ci` and `npm run deps`, then follow
the README to configure and start the database and application. Preserve existing
environment files and database volumes when updating a checkout.

Work on a focused branch, such as `feat/catalog-search`, `fix/loan-return` or
`docs/setup-guide`. Check `git status` before switching branches and preserve any
uncommitted work. Use your own Git identity and review the staged diff before
committing. Each member records the changes they take responsibility for.

A commit message should describe the change, for example:

```text
fix(loans): preserve the original return confirmation
```

## Code structure

- Route handlers own HTTP parsing, authorization integration and response selection.
- Services own business rules and transaction boundaries.
- Repositories use parameterized SQL on the supplied database client.
- Keep every operation in a transaction on the same client. Do not open another
  connection or commit inside a repository method.
- Reuse shared errors, middleware, UI components and the client HTTP layer.
- Keep frontend DTOs aligned with the API contract; do not import backend source
  into the browser bundle.
- Add files when they have a responsibility; avoid empty module placeholders.

Changes to an API contract must update OpenAPI, the resource/method registry,
relevant Postman requests and tests together.

## Database changes

Add a new numbered SQL migration. Migrations already merged are immutable because
the runner verifies their checksums. Update `CURRENT_SCHEMA_VERSION` in
`server/src/db/migrate.ts` when adding a migration. See the
[migration guide](server/migrations/README.md) for transaction restrictions.

Integration tests use `TEST_DATABASE_URL`, with a database name ending in `_test`.
Tests create and remove their own schemas. Never reset the development database
to resolve a test failure.

## Validation

| Change                     | Required validation                                         |
| -------------------------- | ----------------------------------------------------------- |
| Application source         | `npm run check`                                             |
| Database or business rules | `npm run check` and `npm run test:integration`              |
| UI or integrated flows     | `npm run check` and the relevant E2E flows                  |
| API contract               | Contract validation plus affected HTTP/integration tests    |
| Documentation only         | Formatting, local links and accuracy of commands and claims |

Use `npm run test:e2e -- --retries=0` for a managed browser run. State which
checks actually ran, their environment and any limitations. A previous successful
run does not validate a new commit. Keep historical evidence dated and scoped.

## Pull requests

Describe the problem, resulting behavior and relevant validation. Include
screenshots for UI changes when useful. Identify contract or migration changes,
remaining work and checks not run. Resolve conflicts, inspect the resulting diff
and rerun affected checks before requesting approval on a changed head.

A second member reviews each PR. The `quality` and `containers` checks must pass
before integration. Maintainers configure `main` branch protection in GitHub to
require a PR, successful checks and at least one approving review.

Do not commit local environment files, passwords, tokens, dependency folders,
build output or personal-data dumps. Keep authorship, references and validation
results accurate. Tool use and team responsibility are described in
[AI_ASSISTANCE](docs/AI_ASSISTANCE.md).
