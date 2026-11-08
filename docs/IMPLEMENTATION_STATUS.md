# Implementation status

Application baseline: `main@ba8b18d9b5c99057d35036fe739aea72769ba2d0`.
PRs #9, #12, #10, #11 and #13 have merged. This page describes implemented
functionality; the [blueprint](PROJECT_BLUEPRINT.md) also includes future ideas.

| Area                     | Implemented behavior                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Authentication and users | Registration, login, signed JWT, roles, account status, refresh rotation, CSRF and logout                            |
| Catalog and copies       | Categories, books and physical copies, search, filters, pagination, archive, ETag/304 and If-Match/428/412           |
| Loans                    | Member borrowing, limits and overdue rules, transactional return, idempotent return results and audit events         |
| Administration           | Staff dashboard, administrator user management and audit access                                                      |
| Frontend                 | Role-aware navigation, English/Vietnamese, URL filters and page sizes, draft preservation and session-change cleanup |
| HTTP contract            | OpenAPI, structured errors, method checks and Allow headers, role-sensitive response validation                      |
| Tooling                  | Shared dev configuration, proxy, isolated E2E batches, Docker/Nginx, CI and compressed-body regression tests         |

## Integration record

- #9 reorganized the repository and shared code.
- #12 integrated Q1–Q3: identity and language state, session coordination and HTTP method contracts.
- #10 integrated A1–A3: loan response data, return confirmation and runtime contract checks.
- #11 integrated T1–T3: dev configuration, Catalog URL state and handoff documentation.
- #13 updated body-parser to 2.4.0 and added compressed-request regression tests.

The final main push passed quality and containers in
[GitHub Actions run 42364111090](https://github.com/minhquan006/bookflow-rest-api/actions/runs/42364111090).
This is a recorded result for the baseline above, not a claim about future commits.

## Validation scope

See [SOURCE_FINALIZATION](SOURCE_FINALIZATION.md) for the final local validation:
299 tooling/backend/frontend tests, 111 integration tests, 44 native browser
cases without retries and 11 Docker smoke checks. Mobile cases use browser
emulation. Docker verification covered build, health and HTTP smoke.
Benchmark and Newman evidence is historical and was not rerun in that pass.

## Remaining submission work

The source baseline is integrated. Report, PDF, slides, video and submission
verification are separate deliverables tracked in
[REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md). Public hosting,
reservations, email notifications and OAuth login are not part of this release.
