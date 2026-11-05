# An: loan identity, return UX and response contracts

The initial-base statements and dated results below are historical. See the
latest main integration section at the end for the prepared PR #10 update on
main@b009783 after #9/#12. Prepared source is not a merge of #10 into main.

Validation date: **31/10/2026 (UTC+7)**. Tasks: **A1, A2, A3** in the supplied
`QUALITY_IMPROVEMENT_PLAN.md`. Implementation commit:
`374509bcbad91a77b1aaef75462c7a2835a67737`.

PR [#9](https://github.com/minhquan006/bookflow-rest-api/pull/9) was **Draft and
unmerged** before choosing the base. The public PR page and fetched Git refs
were checked; its head `40eb9143866306725767f3121599e678e3fddc7c` was not an
ancestor of `origin/main`. This branch, `feat/an-loan-identity-contract`, starts
from `main@d3d614fb125c2c65538e1737b2a6b0a248eff5f7`. It does not include PR #9's
pending refactor or claim Q3's 405 behavior is implemented.

## Contract and permissions (A1)

Loan creation, list and detail keep their existing IDs and add:

- Required `book: { id, title }` and `copy: { id, barcode }`.
- `borrower: { id, fullName }` for LIBRARIAN/ADMIN; omitted for MEMBER.
- Current metadata, including visible history for archived books; these fields
  are **not snapshots** of the borrowing date.

A joined selection supplies the fields without per-row DB/API calls. Member
ownership remains a parameterized SQL filter; another member's detail stays 404. Integration tests check all three roles, member-only lists, staff identity,
archived history, current title/name changes, pagination/filter totals and absence
of password/token/email fields. Existing concurrency, rollback, loan-limit and
return-idempotency assertions remain. No migration, input change or extra user
identifier on borrowing was added. OpenAPI and the business Postman collection
were updated. The DTO is ready for Quân's permission/contract review and Tú's UI
review; this record does not assert their agreement or approval.

## Return UI (A2)

History and detail show the title/barcode and staff borrower name. Confirmation
shows the selected borrower, book and copy. Pending confirmation disables return
and cancel controls. Success requires the matching loan ID, a valid staff UUID
and timestamp. An ambiguous failure keeps the confirmation visible, asks staff
to refresh history and never retries the mutation automatically.

The two return instructions now use the dictionary. The loan-specific active
label is `Active loan` / `Đang mượn`; overdue and returned labels remain translated.
Record contents are rendered as plain text, without translating user/book names.
Viewer changes invalidate old returns even when switching away and back to the
same staff account. Existing detail cancellation, last-page recovery and filters
are retained.

Two focused EN/VI regression cases were run against the original
`origin/main:client/src/features/loans/LoansPage.tsx`: **2 failed, 15 skipped,
exit 1**, as expected. The original file was restored after this temporary check.
With the implementation, the entire loan component suite passed **17/17**.

## Actual response validation (A3)

`server/tests/helpers/openapi.ts` loads local OpenAPI references only and uses
Ajv's JSON Schema 2020-12 engine with format validation. It validates an explicit
operation/status, documented response headers, Content-Type and body. It also
checks empty bodies for 204/304 and Problem Details status/request-ID correlation.
No coercion, inserted defaults, runtime production validator or error-as-success
schema is used. `contract:check` retains its existing spec/Postman checks.

| Operation ID                  | Response statuses validated                                |
| ----------------------------- | ---------------------------------------------------------- |
| getLiveness                   | 200                                                        |
| register                      | 201                                                        |
| login                         | 200, 401                                                   |
| refreshSession                | 200                                                        |
| logout                        | 204                                                        |
| createBook                    | 201                                                        |
| getBook                       | 200, 304                                                   |
| updateBook                    | 200, 412, 428                                              |
| updateBookCopy                | 200                                                        |
| deleteCategory                | 204                                                        |
| createLoan                    | 201                                                        |
| listLoans                     | 200                                                        |
| getLoan                       | 200, 401, 404                                              |
| returnLoan                    | 200, 403                                                   |
| All 32 implemented operations | 405, plus header/body checks for unsupported HEAD on login |

Negative cases demonstrate rejection of missing required fields, incorrect types,
extra properties, wrong/missing headers, wrong media types, unexpected/undocumented
statuses and forbidden response bodies. Mutated real loan responses specifically
prove that a missing `book` or numeric `copy.barcode` fails validation. Role-based
borrower omission/presence and ID consistency also retain explicit assertions.

Beyond the newly added 405 coverage, these 18 operations still have no other
response statuses wired to this helper: getReadiness, getApiInfo,
getOpenApi, getApiDocs, getCurrentUser, listUsers, updateUser, listCategories,
createCategory, replaceCategory, listBooks, replaceBook, archiveBook,
getAvailability, listBookCopies, createBookCopy, getDashboard and listAuditLogs.
Other status combinations for covered operations are not claimed. Existing tests
for these operations are still run, but are not equivalent to schema validation.
The 405/Allow coverage was added after Q3 landed in main@b009783; see the latest
integration record below. Covering 405 does not imply success responses or other
errors for those operations have schema assertions.

## Commands and results

Environment: Codex Linux cloud, Node **24.19.0**, npm **11.9.0**, PostgreSQL
**17.6** (`postgres:17.6-bookworm`), system Chromium. Local development ports
5432/3000/5173; `_test` DB with random test schemas. No development DB reset.

| Check                                                                  | Result (exit code)                      |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `npm run check`                                                        | Passed: 67 server + 88 client tests (0) |
| `node --env-file=server/.env "$(command -v npm)" run test:integration` | Passed: 107 tests (0)                   |
| `npm --prefix client test -- --run tests/loans.test.tsx`               | Passed: 17 tests (0)                    |
| `npm run test:e2e -- --project=chromium`                               | Passed: 12 tests (0)                    |
| `npm run test:e2e -- --project=mobile`                                 | Passed: 12 tests (0)                    |
| `git diff --check`                                                     | Passed (0)                              |

`check` includes lint, source/test type checks, both builds, unit/component tests,
32-operation OpenAPI/spec and Postman JSON checks, and formatting. The explicit
Node env-file invocation supplies the existing local configuration without
printing credentials; CI already supplies the required environment variables.

An earlier combined `npm run test:e2e` passed all 24 cases. A subsequent combined
run passed 23 and failed the mobile language search after hitting the unchanged
**300 requests/minute** API limit (trace: HTTP 429, remaining 0, Retry-After 25).
Each project was then run separately with fresh Playwright-managed servers; all
24 cases passed. No limit was raised/disabled and no assertion or test was skipped
to obtain the project results. Business-flow confirmation identifies the selected
borrower/title/barcode in desktop English and mobile Vietnamese.

Mac 5433/3100/5174, container builds, benchmarks, Newman execution and GitHub Actions
were not validated by this work. Historical evidence was not rewritten. Codex
assisted implementation/testing; An should read and explain the change. Human
review remains pending: Quân for A1/A3, Tú for A2. Merge remains a team decision.

## PR #10 review follow-up (31/10/2026, UTC+7)

Quân's review of `afc05ae` identified two frontend response-validation defects:
a one-element `returnedBy` array was coerced into a UUID string by the regex,
and `Date.parse` normalized impossible dates such as February 30. These are
mock-response robustness cases, not evidence that the backend emits such data.

`client/src/features/loans/response.ts` now guards an `unknown` response before
narrowing it to `LoanReturn`. It checks `returnedBy` is a string before its UUID
pattern. Timestamp validation checks the written calendar date (including the
Gregorian leap-year/century rules), time and offset ranges before parsing the
instant. Valid offsets, fractional seconds and lowercase RFC 3339 separators
remain supported. A different staff member's original return confirmation is
accepted without substituting the current account or changing its timestamp.

The expanded Loans component suite failed **7 cases, with 23 passing**, before
the fix (exit 1); all **30 passed** afterward (exit 0). Cases cover an array,
null/numeric staff IDs, February 30, February 29 in non-leap years including
1900, April 31, invalid clock/offset hours, and valid leap days including 2000.
Rejected responses leave confirmation open, display the refresh-history guidance
and make only one PUT request. Positive cases also check the displayed original
staff identity and return time.

New cloud checks, all exit 0:

- `npm run check`: **67 server + 101 client tests**, lint, type checks, builds,
  contract/spec/Postman and formatting checks passed.
- `npm run test:e2e -- tests/e2e/business-flow.spec.ts`: **2 passed**, desktop EN
  and mobile VI borrowing/return flows against the actual API and database.
- `git diff --check`: passed.

No backend, schema, contract or dependency changes were needed. The DB integration
suite, container checks and remaining browser specs were not rerun for this
frontend-only follow-up. GitHub Actions for the new head have not been verified.
`main` remains `d3d614f`, with PR #9 still unmerged; this follow-up does not claim
that the two PRs have been integrated or independently approved.

## CI browser-project isolation (31/10/2026, UTC+7)

For `d5617a8`, pull-request run
[41212350110](https://github.com/minhquan006/bookflow-rest-api/actions/runs/41212350110)
passed both quality and containers. Push run
[41212344969](https://github.com/minhquan006/bookflow-rest-api/actions/runs/41212344969)
passed containers but failed E2E: 23 passed and the mobile language test failed,
including its retry. The PR's synthetic merge tree equals the branch tree. The
public job page and supplied log screenshot do not show the detailed assertion or
HTTP failure, so this record does not attribute that CI failure to HTTP 429.

A fresh local run with CI settings and a newly created `_test` database passed
all 24 tests together (exit 0). This confirms a passing execution, not the root
cause of the failed hosted run. The temporary database was removed afterward;
the development database was unchanged.

The quality workflow now invokes desktop and mobile in separate Playwright runs,
so each project starts a fresh API process under `CI=true`. This removes the
shared cross-project request budget that previously produced an observed local
HTTP 429 in the last mobile language case. The same 24 tests, assertions, retries,
auth configuration and production/global rate limits remain. A failure in either
invocation still fails the quality job and retains failure artifacts.

The exact new commands were exercised sequentially against another freshly
created and seeded test database, with the same CI settings:

- `npm run test:e2e -- --project=chromium`: **12 passed**, exit 0.
- `npm run test:e2e -- --project=mobile`: **12 passed**, exit 0.
- Workflow YAML parsing and Prettier validation: passed.
- `git diff --check`: passed.

The temporary database was removed. This workflow-only follow-up does not rerun
unrelated application unit/integration or container suites locally. A new hosted
CI run is still required to verify the changed workflow; the failed run's detailed
error and formal human approvals remain outstanding.

## Integration preview with PR #9 (05/11/2026, UTC+7)

A local, uncommitted merge preview combines these exact inputs:

- PR #9: `40eb9143866306725767f3121599e678e3fddc7c`.
- PR #10: `3d0695d4693621f012d053c4824eebebb6c82f4f`, after An corrected the Git
  identity to `An Lê <anle15674@gmail.com>`; its source tree matches the earlier
  CI-fix head `a1bd041`.

One conflict occurred in `client/src/features/loans/LoansPage.tsx`. The resolution
keeps `formatLibraryDate` from the shared `lib/datetime` module and
`isLoanReturnResponse` from the loan response guard. The refactored router/layout,
shared pagination types, loan identity DTO and return/viewer protections remain.
No production behavior was changed beyond combining the existing PRs.

Linux cloud results for this combined source, before adding this documentation:

- `npm run check`: 67 backend + 103 frontend tests; lint, typecheck, both builds,
  32-operation OpenAPI/Postman checks and format passed.
- Integration: 107/107 passed on a newly created dedicated `_test` database.
- E2E: 12/12 desktop and 12/12 mobile passed with retries=0 and a fresh API per
  project. The temporary test database was removed after the run; development
  data and the global API rate limit were not changed.

At the remote check for this preview, main was still
`d3d614fb125c2c65538e1737b2a6b0a248eff5f7`; PR #9 had not landed there. These
results are a local preview, not CI for a new PR #10 head or verification of main.
No merge commit, push or GitHub review was created by Codex. PR #11/T1–T3 and
PR #12/Q2–Q3 are not included; in particular, this preview does not add Q3's
405/Allow implementation or A3 coverage for it. After #9 lands, compare the real
main and PR #10 inputs again before applying the prepared resolution and
requesting CI on An's own pushed commit.

## Main integration after #12 (06/11/2026, UTC+7)

Prepared, uncommitted update for PR #10 from these exact inputs:

- An head: `0f9ef827ba70c4a19b47dee15b1a47dacf68b389`.
- Main: `b009783ce455faf0a0acb597e3b79d6e09e6f9f7`, containing #9 and #12.

The merge completed without conflicts. OpenAPI retains both the loan identity
schema and Q3's 405/Allow responses. Shared datetime/pagination, AppRouter viewer
keys, `isLoanReturnResponse` and session coordination remain in the combined source.
No new production handler, migration, auth policy or DTO/input change was needed.

A3 now includes `server/tests/method-contract.test.ts`: 32 HTTP 405 samples, one
per implemented OpenAPI operation, validate the actual composed app/router
responses through the existing AJV helper. Expected Allow method sets are derived
from OpenAPI independently of the runtime registry; extra/missing/duplicate
methods fail. These tests stub only the live-user DB lookup, not the HTTP router.
Three additional cases verify 401/403 without Allow, unsupported HEAD with no body,
and rejection of missing Allow or invalid/uncorrelated Problem Details. The helper
checks documented status/headers/media type for HEAD and deliberately requires an
empty body instead of validating a body that HTTP forbids.

Four new DB integration cases use the complete API router and real test users:
MEMBER/LIBRARIAN/ADMIN keep the correct loan DTO, protected method negotiation
respects roles, and a disabled account receives 401 before 405. Wrong return
methods leave returned_at null and create no loan.returned audit. Existing
ownership, concurrency, rollback and idempotency assertions are retained.

A new E2E flow holds a real return response after the database commit. Confirmation
and cancel stay locked; a second tab logs out 204 and the old refresh token gets
401 before releasing the response. The original tab does not show stale success
or repeat PUT. An explicit API repeat by another staff account preserves the
original return data, and there is exactly one audit event. This flow runs in
English desktop and Vietnamese mobile; it is not a repeat of the full eight-way
A2 browser matrix from Tú's earlier review at 3d0695d.

Results on the prepared combined source in Linux cloud, Node 24.19.0/npm 11.9.0,
PostgreSQL 17.6 and Chromium:

- `npm run check`: 133 backend + 119 frontend tests passed, including 35 new
  method-contract tests; lint, typecheck, both builds and contract checks passed.
- Integration: 111/111 passed, including the four new real-DB composition cases.
- E2E: 21/21 desktop + 21/21 mobile passed with retries=0 and a fresh API per
  project, including the new late-return/session case in each project.
- Following documentation updates, format:check and git diff checks were rerun.

The runner created a random dedicated `_test` DB, seeded synthetic fixtures and
removed only that DB after finishing. No development DB reset, global rate-limit
change, automatic mutation retry or weakening of existing assertions. No Windows
or Mac results are claimed for this new combined source; Docker/Newman/benchmark
were not rerun locally. Historical validation evidence remains unchanged.

These results describe prepared source, not a new pushed commit or CI for PR #10.
An will apply the bundle, inspect/test and commit/push manually using Vanan1507.
Quân still needs to review A1/A3 on the new pushed head. #11/T1–T3 is not included;
Tú updates it after #10 merges, following #9 → #12 → #10 → #11.
