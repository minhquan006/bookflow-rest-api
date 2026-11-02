# T1-T3 - Tu quality handoff

Base `origin/main@d3d614f`; source checked on 30/10/2026 in the Linux cloud workspace.
Branch `feat/tu-quality-improvements`. Implementation commit `49d7070` was
pushed for review in [PR #11](https://github.com/minhquan006/bookflow-rest-api/pull/11).
The initial cloud checks below were performed before that commit.

- T1: shared HOST/PORT/WEB_PORT; proxy API/docs/OpenAPI/health; relative Swagger;
  strict ports; Mac profile 5433/3100/5174; preserve existing env/data/processes.
- T2: 12/24/48 sizes; applied query/sort/page/size in URL; drafts stay separate;
  reload/history/detail return; invalid page correction; viewer-specific results,
  cancellation and per-viewer/client category cache with retry invalidation.
- T3: current PR #4–#7 status and setup; historical validation kept separate.

Raw-role viewer keys are the minimal Q1 overlap for Quân to review. Q2/Q3 and
A1–A3 are separate work. No API/schema/authentication semantics changed.

## Actual cloud verification

Linux, Node 24.19.0/npm 11.9.0, baseline plus uncommitted diff; no CI claim.

| Check                 | Result                                                                               | Limits                                      |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| npm run check         | 5 tooling + 66 server + 88 client tests passed; lint/typecheck/build/contract/format | React advisories, no lint errors            |
| Managed E2E           | 13 desktop + 13 mobile passed                                                        | Default DB5432/API3000/web5173              |
| Mac-port smoke        | 11 checks passed                                                                     | Isolated DB5433/API3100/web5174 on Linux    |
| Mac-port external E2E | 18 cases passed                                                                      | Catalog/language/foundation, desktop/mobile |
| Viewer-key regression | 2 expected failures before, 2 passes after                                           | App create/edit/copy drafts across EN/VI    |

The first combined browser run hit the unchanged 300/minute IP limit. Fixtures
now batch 13 synthetic books into the selected DB and delete only their rows;
managed projects have separate server lifetimes, and category options are reused.
External servers are never restarted. No limiter was removed or raised for this.
Setup tests cover fresh/repeated Mac settings; the conflict test preserves the
existing port owner. Linux Mac-port checks are not macOS hardware verification.

Windows was not verified during the earlier cloud run; see the later Windows results below. Integration DB tests,
full API/Nginx rebuild, benchmark, manual Postman and GitHub Actions were not rerun.
Original cloud screenshots remain there; this PowerShell transfer is text only.
Capture actual Windows screenshots after running local checks; do not relabel
cloud results as Windows evidence. Original validation documents remain historical.

AI assisted implementation/verification. Tú reads and explains the changes;
Quân reviews T1/T3 and shared Q1 key; An reviews T2. Tú reviews Q1/A2 separately.
The current Loans return helper strings still require An's A2 review; unseen future
PRs are not approved here. No automatic PR, message or merge was performed.

## Windows verification

Recorded from PowerShell outputs supplied by Tu.
Documentation updated: 2026-10-31 21:06:19 +07:00.
This timestamp records the documentation update, not the test start time.

- Environment: Windows, PowerShell, Node v24.19.0, npm 11.17.0.
- Checkout HEAD: d3d614fb125c2c65538e1737b2a6b0a248eff5f7, plus uncommitted T1-T3 changes.
- npm run check passed: 5 tooling, 66 server and 88 client tests;
  lint, typecheck, build, OpenAPI/Postman and formatting passed.
- Database container healthy; migrations up to date.
  Seed preserved existing accounts/passwords; test DB creation removed no data.
- Managed browser tests passed: 13 desktop and 13 mobile.
- HTTP smoke passed all 11 checks through http://127.0.0.1:5173:
  liveness, readiness, service identity, Swagger HTML/assets, OpenAPI,
  and five error-response checks.
- git diff --check passed after smoke.

These results supplement the earlier Linux evidence.
Mac hardware, CI, PostgreSQL integration tests and a full API/Nginx container
rebuild are not established by these Windows runs.
After Ctrl+C on Windows, no listeners remained on ports 3000 and 5173.
Manual UI review remains unconfirmed. No commit or push was performed by these verification commands.

## Cross-review Q1/A2 — 02/11/2026

Đã bổ sung [báo cáo frontend độc lập](TU_FRONTEND_REVIEW.md) với SHA cụ thể của
PR #9/#10, regression Q1, browser desktop/mobile EN/VI và API/DB test riêng cho A2.
Đây là kết quả Linux mới, không thay bằng chứng Windows ở trên và không xác nhận
bản ghép #9 + #10 + #11 đã hoạt động. Đợt kiểm chứng này diễn ra trước commit
bộ review; không tự chuyển kết quả đó thành CI của commit phát hành sau này.
