# BookFlow — full repository validation

Source: main `7221e9e983f72f130bc73dce43baaed71422b339`, tree `bdeb196ec01f5d4e114c621bf162b51a2a9076d2`. Executed by Codex on the cloud machine, not on the user Mac or GitHub Actions. Recorded in Vietnam time: 2026-10-24T18:06:58.806672+07:00.

Final outcome: **PASS after one documented environmental browser rerun**. Source, assertions and lockfiles were not changed.

| Check | Outcome |
| --- | --- |
| Lint, typecheck, server/client build, OpenAPI and format | Passed; existing React lint advisories remain |
| Server unit/HTTP | 66 passed |
| Client unit/component | 73 passed |
| PostgreSQL integration | 105 passed |
| Native dev-stack E2E, desktop/mobile Chromium | 22 passed |
| Docker/Nginx E2E, desktop/mobile Chromium | 22 passed |
| API/web Docker images | Built successfully with TLS verification retained |
| Docker migration and seed | Each ran twice successfully, preserving existing DB |
| Docker HTTP smoke | 11 checks passed |
| Newman smoke collection | 6 requests, 13 assertions, 0 failures |
| Newman business workflow | 20 requests, 33 assertions, 0 failures |
| Newman Catalog collection | 21 requests, 21 assertions, 0 failures |

The 22 browser cases are the same suite exercised through two deployment modes; they are not 44 unique scenarios. Docker browser/Newman runs used the documented AUTH_RATE_LIMIT_MAX=100 test budget. Unit/HTTP tests still exercised the default rate-limit behavior. API ran as UID 1000, web as UID 101; the API had no published host port.

## Benchmark

Synthetic catalog reads over local HTTP and PostgreSQL: 1,000 books, 3,000 copies, 10,000 historical loans; 20 warm-up requests, 500 measured requests at concurrency 20. **500 HTTP 200, 0 errors**. p50 32.26 ms, **p95 55.26 ms**, p99 96.12 ms; throughput 559.29 requests/s. The repository p95 < 500 ms target was met. This is a local synthetic read benchmark, not a production capacity or loan-write/login benchmark. Full environment/workload data is in benchmark.json.

## Initial browser failure and investigation

The first native E2E attempt passed 21 cases and timed out in the mobile staff Catalog case before the Email field appeared. Its screenshot was blank and the trace console recorded net::ERR_NETWORK_CHANGED while Docker was starting concurrently. After container networking/startup settled, the unchanged native suite passed all 22 cases; all 22 also passed through Docker/Nginx. Docker startup is a plausible trigger. This run does not establish a reproducible application defect. The original failed-attempt log is retained; raw browser traces are excluded from this shared package because they may contain session/authentication data.

## Commands and scope

Commands were executed at /workspace/bookflow-rest-api with the pinned Node/npm toolchain:

```bash
npm run check
npm run test:integration
npm run test:e2e
npm run compose -- build api web
docker compose run --rm --no-deps api npm run db:migrate
docker compose run --rm --no-deps api npm run db:seed
# Repeat migrate and seed once to check idempotence.
AUTH_RATE_LIMIT_MAX=100 docker compose up -d --wait api web
npm run smoke
E2E_EXTERNAL=1 E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
# Newman 6.2.1 ran the three implemented collections with in-memory credentials.
# BENCHMARK_OUTPUT pointed outside the checkout:
npm run benchmark
```

Newman used the unmodified checked-in collection definitions and existing seeded admin authentication. Credentials/tokens were provided in memory and were not exported. Only sanitized stats, request names and response statuses are in newman.json. The `planned` collection is documented as historical examples, not an automated acceptance suite, and was not run.

Integration/benchmark used the dedicated `_test` DB and disposable schemas. Browser/Postman runs created synthetic local records and retained history; development data was not reset. API/web containers started for this run were stopped afterward; the pre-existing DB and its volume were kept. No production/HTTPS or physical-device browser validation is claimed.

Logs and machine-readable results are included. Check SHA256SUMS.txt for transport integrity.
