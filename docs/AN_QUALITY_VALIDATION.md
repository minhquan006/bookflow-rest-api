# An: loan identity, return UX and response contracts

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

| Operation ID   | Response statuses validated |
| -------------- | --------------------------- |
| getLiveness    | 200                         |
| register       | 201                         |
| login          | 200, 401                    |
| refreshSession | 200                         |
| logout         | 204                         |
| createBook     | 201                         |
| getBook        | 200, 304                    |
| updateBook     | 200, 412, 428               |
| updateBookCopy | 200                         |
| deleteCategory | 204                         |
| createLoan     | 201                         |
| listLoans      | 200                         |
| getLoan        | 200, 401, 404               |
| returnLoan     | 200, 403                    |

Negative cases demonstrate rejection of missing required fields, incorrect types,
extra properties, wrong/missing headers, wrong media types, unexpected/undocumented
statuses and forbidden response bodies. Mutated real loan responses specifically
prove that a missing `book` or numeric `copy.barcode` fails validation. Role-based
borrower omission/presence and ID consistency also retain explicit assertions.

The other 18 operations are not yet wired to this helper: getReadiness, getApiInfo,
getOpenApi, getApiDocs, getCurrentUser, listUsers, updateUser, listCategories,
createCategory, replaceCategory, listBooks, replaceBook, archiveBook,
getAvailability, listBookCopies, createBookCopy, getDashboard and listAuditLogs.
Other status combinations for covered operations are not claimed. Existing tests
for these operations are still run, but are not equivalent to schema validation.
405/Allow must be added after Q3 establishes its implementation and contract.

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
