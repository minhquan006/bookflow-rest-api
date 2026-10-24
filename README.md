# BookFlow — current downloads

All module PRs are merged into main `7221e9e` (PR #6 merge). Auth/Users, Catalog/Copies and Loans/Dashboard/Audit are integrated, including the Catalog boundary and Loans pagination fixes. See MERGED_STATUS.md for exact source/validation provenance.

- **bookflow-source.zip**: exactly the complete merged tracked source at main `7221e9e`. Extract and follow its README to install dependencies and generate local configuration. No Git history, real .env credentials, node_modules, build outputs or DB data is included. For development with history, clone/pull the main branch instead.
- **bookflow-15-commits.zip**: historical team handoff patches, instructions and logs, now marked as historical. Quân/Tú/An have finished their workflows. Do not replay these patches on current main or create duplicate module PRs.
- **an-loans-v2-5commits.zip**: historical An handoff before the final pagination review correction. Keep only as a record; use merged main for current work.
- **bookflow-mac-dev.mjs**: optional local development launcher when ports 3000/5173 belong to another app. Run it from repository root, with the helper file outside checkout. It starts API 3100/web 5174 and proxies API/docs/health. Keep it running; set E2E_EXTERNAL=1 and E2E_BASE_URL=http://127.0.0.1:5174 in the test terminal. Configure DB separately (Quân's Mac uses host 5433).

Do not merge this download-only branch into main. Download this branch using Code > Download ZIP, then extract bookflow-source.zip for the current standalone source. Member histories are preserved in main (Quân 5, Tú 6, An 6 module commits, excluding merges).

Next work is shared acceptance on team machines and preparation of the English report, slides and presentation/video. The source tree matches the reviewed afd067c exactly: 66 server + 73 client, 105 PostgreSQL integration and 22 browser tests passed on that tree. These are cloud review results, not a claim that a new machine, current main CI or production deployment has been verified.

## Latest full test run on merged main

Download **bookflow-test-report-main-7221e9e.zip** for sanitized logs and JSON results, or read **TEST_REPORT_MAIN_7221E9E.md**. Fresh cloud run: 66 server + 73 client tests, 105 PostgreSQL integration, 22 native dev-stack browser cases, 22 Docker/Nginx browser cases, Docker API/web build, repeated migrate/seed, 11 HTTP smoke checks, and Newman 47 requests/67 assertions all passed in the final runs. Benchmark: 500 HTTP 200, 0 errors, p95 55.26 ms at concurrency 20 over the documented synthetic dataset. An initial native mobile case failed with ERR_NETWORK_CHANGED during concurrent Docker startup; its log is retained and all 22 passed after networking settled without source/assertion changes. No real credentials or raw browser traces are shared. These are cloud results, not a new Mac or GitHub Actions run.

## Optional Vietnamese interface update (not merged into main)

Download **bookflow-vietnamese-update.zip** for the patch against main `7221e9e`,
Vietnamese Mac instructions, PR text and sanitized validation receipts. Read
**VIETNAMESE_UPDATE.md** before applying it. **bookflow-vietnamese-source.zip** is
the full proposed source without Git history or local credentials. The existing
**bookflow-source.zip** above still represents merged main, without this feature.

The header selector switches English/Vietnamese and remembers an explicit choice.
It preserves the session, form drafts and filters. Cloud validation passed: 66 server,
80 client tests and 24 desktop/mobile browser cases. No API/database/dependency
changes or limiter changes. Review and test on your own machine before opening the
feature PR. Do not merge the download-only branch.
