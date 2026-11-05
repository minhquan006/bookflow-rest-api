# Repository maintenance and PR review

Review date: 30 October 2026. Baseline: main@d3d614f. This document records the
cleanup scope and static review; it does not claim a new production deployment
or a new full DB/browser validation run.

## PR 3 review

PR #3, "feat(catalog): implement Catalog API and public browsing UI", is an
old draft from feat/catalog@1bdf367. At inspection GitHub reported it open,
not mergeable, with 17 commits and 51 changed files. PR #5 is already merged.

The Books/Categories/Copies backend directories and their original Books and
Categories tests are byte-for-byte identical between PR #3's head and the
integrated main baseline. Catalog UI on main adds shared Auth, staff screens,
Loans integration and translations. These are reasons to close the obsolete
draft rather than merge it again or resolve conflicts by restoring old files.

Static findings on the old PR head:

- client/src/App.tsx lines 122–127 still compose the foundation/planned-module
  screen rather than the integrated Auth/Users/Loans application.
- Lines 17, 24, 30 and 159 contain mojibake such as "Â·" and "APIâ€¦".
- Lines 102–104 repeat the same catalog exclusion condition.

GitHub reported a successful historical Foundation checks workflow associated
with this head (run 39457411459). That result does not establish compatibility
with today's integrated main. The old PR's tests were not rerun during cleanup.

Review recommendation: close PR #3 as superseded by PR #5. Preserve its unique
commit history before deleting feat/catalog. No review comment is posted by
this maintenance change; the review is recorded here for the team.

## Retention and branch cleanup

Before pruning local refs, a complete local Git bundle was created and verified.
It preserves the existing local/remote refs, including historical delivery
artifacts. Uncommitted work is kept separately in the current checkout.

The intended recovery tags are archive/catalog-pr-3 at 1bdf367 and
archive/bookflow-download at d18d0d3. The former retains the old contributor
history; the latter retains source/evidence downloads from the removed delivery
branch. Publish and verify the tags before removing the obsolete Catalog branch.

Keep main and any active, reviewed cleanup branch. Prune stale remote-tracking
refs and delete only local feature/setup branches already merged into the
current integrated history. Existing commit authors and dates are unchanged.

## Source cleanup

Remove unused React/Vite starter assets and the unused nav-note styles.
Remove the obsolete planned Postman collection and update its checker and
references. Keep the smoke, Catalog and business collections.

Refresh current handoff/status/client documentation. Keep the blueprint,
assignment, migration, validation records, screenshots and meaningful quality
plan. Historical test counts must remain attached to their actual revision and
environment. AI assistance disclosure remains accurate.

Dependencies, generated outputs and local environment files are already ignored
and are not GitHub content. Local port overrides, credentials and DB volumes are
not cleanup targets. No business API, schema or migration is changed.

## Validation of this cleanup

On the Mac checkout, Node 24.19.0 and npm 11.17.0:

- npm run check passed: lint, type checks, both builds, 66 server tests,
  80 client tests, OpenAPI/Postman checks and repository formatting.
- The 11 existing React lint warnings remain; this cleanup does not change
  the React logic that emits them.
- Modified Markdown links were checked against local targets with no missing files.
- The first sandboxed attempt could not bind the HTTP test listener (listen
  EPERM); the same checks passed outside that sandbox without changing assertions.
- DB integration, E2E, Docker, Newman and benchmark were not rerun. No business
  logic or rendered UI behavior was changed; only unused styles/assets and the
  obsolete collection were removed alongside documentation updates.
