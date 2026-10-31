# Quality improvement plan - reference

Concise reference to Quân's full plan dated 30/10/2026, supplied separately.
Keep the original team document. This reference does not mark every task done.
Baseline: `main@d3d614f` after PRs #4–#7. Do not reapply historical bundles.

| Task | Owner | Scope                                                      | Reviewer |
| ---- | ----- | ---------------------------------------------------------- | -------- |
| Q1   | Quân  | Preserve form state on language changes; clear old viewer  | Tú       |
| Q2   | Quân  | Refresh/logout/CSRF coordination across tabs               | An       |
| Q3   | Quân  | Distinguish 404/405 and correct Allow                      | An       |
| T1   | Tú    | Consistent ports/proxy/Swagger, Mac 5433/3100/5174         | Quân     |
| T2   | Tú    | Catalog page sizes and applied state in URL/history        | An       |
| T3   | Tú    | Current technical setup/status/handoff and honest evidence | Quân     |
| A1   | An    | Role-appropriate loan DTOs without N+1                     | Quân     |
| A2   | An    | Return confirmation, EN/VI, pagination and stale responses | Tú       |
| A3   | An    | Validate actual HTTP responses against OpenAPI schemas     | Quân     |

The raw-role App viewer key in T2 is a minimal Q1 prerequisite; Quân reviews it.
Other Q/A tasks are not completed by T1–T3. Run check for source changes, E2E
for UI changes, PostgreSQL integration for DB/business changes. Preserve existing
services and dev DB. Never rewrite merged migrations or fake contribution history.

Record actual source/environment/results and AI assistance in PRs. Old validation
counts remain historical. Human owners review and explain changes before merge.
Reports/slides/video are outside this round. See [Tú's handoff](TU_QUALITY_HANDOFF.md).
