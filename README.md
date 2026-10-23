# BookFlow download and member handoff

Current merged main: `50e2dc4`, after Auth PR #4 and Catalog PR #5 including its review fix. The next member is An.

## Download for An

Download **an-loans-v2-5commits.zip** using the file download button, or download this whole branch with Code > Download ZIP. Extract it outside the repository; read an-loans-v2/README.md. This v2 replaces the old An package, whose base tree no longer matches main. Use the repository cloned from GitHub plus this patch series. Node 24.19.0, npm 11, Docker PostgreSQL and Chromium are required. An reviews/tests and creates each commit with their own Git identity; scripts do not push or change authors.

The five steps prepare backend, Loans UI, administration UI, integrated navigation/borrowing, and delivery tooling/docs. Borrow controls are restored only at the UI integration step, with the Loans API already present. The Catalog-only review regressions are adapted to the integrated behavior; availability/cache/visibility checks remain.

The v2 package includes per-step manifests, checksums and actual validation logs. All five steps passed check/integration/E2E. Final snapshot: 66 server + 71 client tests, 105 PostgreSQL integration tests, 22 browser tests. React lint advisories remain. Full Docker API/web, Newman and benchmark were not rerun. These results are from the cloud workspace, not An's machine or GitHub Actions.

## Other files

- bookflow-15-commits.zip: updated combined handoff. Quân/Tú original folders are historical references because their work is merged; the current An folder is an-loans-v2. The obsolete An folder was removed from this combined archive.
- bookflow-source.zip: complete assembled source preview including the pending An integration; it is not a claim that Loans is already merged into main. It has no Git history and is for reading/running, not replacing the member patch workflow. Local secrets, dependencies, DB data and generated build outputs are excluded.
- bookflow-mac-dev.mjs: optional dev launcher if Mac ports 3000/5173 belong to another app. Run from the repository root, with the file outside the checkout, and keep its terminal open. It uses API 3100 and web 5174 and proxies /api, /docs, /health and /openapi.yaml. In the test/commit terminal set E2E_EXTERNAL=1 and E2E_BASE_URL=http://127.0.0.1:5174. Configure DB host port separately if needed.

Do not merge this download-only branch into main. It preserves distribution files; actual member work goes through its own reviewed PR. If main changes, stop on the base-tree check and reconcile the package rather than bypassing it or resetting anyone's work.
