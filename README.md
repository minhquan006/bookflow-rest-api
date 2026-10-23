# BookFlow download only

This branch delivers two ZIP files. Do not merge this branch into main.

- bookflow-source.zip: complete integrated tracked source from the supplied Auth + actual Tu Catalog + Loans packages. Dependencies and generated outputs are excluded. Run setup from its README; local secrets are generated on your machine.
- bookflow-15-commits.zip: five patch steps per member, self-commit scripts, instructions and validation logs. Use this with the project Git repository for the intended member commit workflow. The standalone source ZIP has no Git history and is for running/reading the complete application.

The old branches and main remain unchanged. Source was verified during the previous task: 137 unit/component, 105 PostgreSQL integration and 20 browser tests at the final snapshot. Benchmark measurements inside source documents are historical, not rerun here. No .env credentials, node_modules or database files are included.

GitHub: download this branch using Code > Download ZIP, then extract the outer ZIP and the two ZIP files inside it. On Mac you may instead clone this delivery branch, then unzip the two files. Do not commit the assembled standalone snapshot as a replacement for the five-step member workflow.

## Mac with EduTrack running

Download bookflow-mac-dev.mjs outside the project checkout. From the BookFlow repository root, run node /path/to/bookflow-mac-dev.mjs and keep that terminal open. It runs the API on 127.0.0.1:3100 and Vite on 127.0.0.1:5174, proxying /api, /docs, /health and /openapi.yaml. It sets the local API allowed origins and test auth rate budget without editing tracked files or .env. In the test/commit terminal export E2E_EXTERNAL=1 and E2E_BASE_URL=http://127.0.0.1:5174, then run npm run test:e2e. These exports must also be present when running each commit-step script. Keep this helper running; API and Vite watch source changes between steps. Ctrl+C stops only the processes started by the helper. PostgreSQL remains on the separately configured host port 5433.

Verified in the cloud execution environment: 6 foundation browser tests at Auth step 1 and all 10 Auth browser tests at the final Auth tree pass using this external dev stack. This is not validation on the user Mac. No application source or member patch series was changed.
