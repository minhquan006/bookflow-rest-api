# Team handoff

BookFlow is the RESTful Web Services midterm project for course 503073.
The integrated application baseline is `ba8b18d9b5c99057d35036fe739aea72769ba2d0`
on main, following PRs #9, #12, #10, #11 and #13. Use the
[root README](../README.md) for installation and [implementation status](IMPLEMENTATION_STATUS.md)
for scope. Earlier branch notes describe historical work, not pending merges.

## Responsibilities

| Member           | Student ID | Responsibility                                                   |
| ---------------- | ---------- | ---------------------------------------------------------------- |
| Nguyễn Minh Quân | 52400227   | Authentication, users, shared integration, report and slides     |
| Phạm Văn Tú      | 52400252   | Catalog, physical copies, frontend and development configuration |
| Lê Nguyễn Vạn An | 52400258   | Loans, dashboard, audit, API validation and deployment           |

Each member reviews the sections describing their module and explains their
implementation during the presentation. The report, slides and recording must
use the same application baseline. Actual contribution and review records remain
in Git and the validation documents.

## Continuing development

1. Check `git status` and preserve local changes before switching branches.
2. Use Node 24.19.0 and npm 11. Run `npm ci` and `npm run deps` from the root.
3. Follow the README to configure, migrate and seed the application. Existing
   environment files and database volumes retain their previous credentials.
4. Create a task-specific branch and keep each PR focused. Review the diff,
   run the relevant checks and obtain peer approval before merging.
5. Record the tested commit, environment, commands and remaining limitations.

Routes handle HTTP, services own business rules and transactions, and repositories
use parameterized SQL on the supplied client. Add new migrations rather than
editing a migration already merged. Test database names must end in `_test`.
Do not reset the development database to resolve test failures.

## Development environments

The default ports are PostgreSQL 5432, API 3000 and web 5173. The Mac profile uses
5433, 3100 and 5174. Setup only creates missing configuration files. See
[DEV_PROFILES](DEV_PROFILES.md) before changing an existing profile.
Local `.cache` helpers and ignored environment files may contain working machine
configuration; their presence alone is not a reason to delete them.

## Validation and release

[Source finalization](SOURCE_FINALIZATION.md) records 299 check tests, 111 database
integration tests, 44 native browser cases and Docker smoke results from the
final application changes. [Evidence](evidence/source-finalization-20261107.json)
records the scope and file hashes. Do not describe older benchmark or Newman
results as reruns on the final baseline.

[Requirements](REQUIREMENTS_TRACEABILITY.md) lists the academic deliverables.
The report and video must be in English. All three members must participate in
the presentation and recording. Check the final upload instructions before submission. The instructor is
Trần Đại Nhân; the class is N01_T02. The deadline supplied by Quân is the
end of 8 November 2026, Vietnam time.

[AI assistance](AI_ASSISTANCE.md) records the use of supporting tools. Team
members remain responsible for checking the code, claims and references.
