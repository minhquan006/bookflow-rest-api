# BookFlow download only

This branch delivers two ZIP files. Do not merge this branch into main.

- bookflow-source.zip: complete integrated tracked source from the supplied Auth + actual Tu Catalog + Loans packages. Dependencies and generated outputs are excluded. Run setup from its README; local secrets are generated on your machine.
- bookflow-15-commits.zip: five patch steps per member, self-commit scripts, instructions and validation logs. Use this with the project Git repository for the intended member commit workflow. The standalone source ZIP has no Git history and is for running/reading the complete application.

The old branches and main remain unchanged. Source was verified during the previous task: 137 unit/component, 105 PostgreSQL integration and 20 browser tests at the final snapshot. Benchmark measurements inside source documents are historical, not rerun here. No .env credentials, node_modules or database files are included.

GitHub: download this branch using Code > Download ZIP, then extract the outer ZIP and the two ZIP files inside it. On Mac you may instead clone this delivery branch, then unzip the two files. Do not commit the assembled standalone snapshot as a replacement for the five-step member workflow.
