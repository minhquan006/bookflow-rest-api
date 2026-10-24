# BookFlow — current downloads

All module PRs are merged into main `7221e9e` (PR #6 merge). Auth/Users, Catalog/Copies and Loans/Dashboard/Audit are integrated, including the Catalog boundary and Loans pagination fixes. See MERGED_STATUS.md for exact source/validation provenance.

- **bookflow-source.zip**: exactly the complete merged tracked source at main `7221e9e`. Extract and follow its README to install dependencies and generate local configuration. No Git history, real .env credentials, node_modules, build outputs or DB data is included. For development with history, clone/pull the main branch instead.
- **bookflow-15-commits.zip**: historical team handoff patches, instructions and logs, now marked as historical. Quân/Tú/An have finished their workflows. Do not replay these patches on current main or create duplicate module PRs.
- **an-loans-v2-5commits.zip**: historical An handoff before the final pagination review correction. Keep only as a record; use merged main for current work.
- **bookflow-mac-dev.mjs**: optional local development launcher when ports 3000/5173 belong to another app. Run it from repository root, with the helper file outside checkout. It starts API 3100/web 5174 and proxies API/docs/health. Keep it running; set E2E_EXTERNAL=1 and E2E_BASE_URL=http://127.0.0.1:5174 in the test terminal. Configure DB separately (Quân's Mac uses host 5433).

Do not merge this download-only branch into main. Download this branch using Code > Download ZIP, then extract bookflow-source.zip for the current standalone source. Member histories are preserved in main (Quân 5, Tú 6, An 6 module commits, excluding merges).

Next work is shared acceptance on team machines and preparation of the English report, slides and presentation/video. The source tree matches the reviewed afd067c exactly: 66 server + 73 client, 105 PostgreSQL integration and 22 browser tests passed on that tree. These are cloud review results, not a claim that a new machine, current main CI or production deployment has been verified.
