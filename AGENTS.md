# Repository guidance

Read `README.md`, `docs/TEAM_HANDOFF.md`, and the relevant sections of
`docs/PROJECT_BLUEPRINT.md` before implementing features. The blueprint is a design,
not a record of completed functionality. `docs/openapi.yaml` marks implemented and
planned operations. Keep status claims accurate.

Use Node 24.19.0 and npm 11. This repository has separate root, server, and client
lockfiles; use `npm ci` at root and `npm run deps` for both applications. Never create
empty module placeholders. Controllers own HTTP, services own business logic and
transaction boundaries, repositories use parameterized SQL on the passed client.
Reuse shared middleware, errors and client HTTP handling. Do not import backend source
into frontend.

Use `npm run check` for source changes. Run `npm run test:integration` for DB/business
changes, and `npm run test:e2e` for relevant UI/integration changes. Test DB names must
end `_test`; do not reset the development database. Migration files already merged are
immutable: add a new numbered SQL file and update current schema readiness version.
Update OpenAPI/Postman when changing contracts. Never commit `.env`, passwords,
authentication tokens, dependency folders or personal-data dumps.

Each cloud task is isolated. Use the existing checkout; do not create a worktree unless
explicitly requested. Docker processes must be restarted in a restored task; see saved
start instructions or README. Do not claim planned auth/catalog/loans routes work until
implemented and verified.
