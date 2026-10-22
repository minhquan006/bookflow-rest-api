## Problem and resulting behavior

Complete the Catalog contribution assigned to Phạm Văn Tú: guests can browse/search/filter books and read availability; LIBRARIAN/ADMIN can manage categories, metadata, archives and physical copies. This branch also includes the previously prepared Auth register/login/current-user integration required by the staff workflow. Auth ownership remains Quân's responsibility for review.

Book writes require strong ETags/If-Match; concurrent stale writes receive 412. Archive/copy changes check open loans under row locks and audit mutations atomically. The UI handles loading/empty/error states and preserves failed edits.

A separate delivery folder contains a 12-page English contribution report (Word/PDF), 10 editable slides with speaker notes, a six-minute narration script and real silent practice footage with English captions. It is not the complete Faculty-formatted group report or final three-member narrated video.

## Contract and data

- Mark the 14 Catalog operations and three Auth operations implemented; update OpenAPI, Postman and handoff documentation.
- No migration, lockfile or dependency changes. Existing merged migration remains unchanged.
- Preserve the existing remote feat/catalog branch. This is a separate draft to compare with its implementation before merge; it does not replace another member's history.

## Validation

- [x] npm run check (lint, typecheck, build, 59 foundation tests, contract and formatting)
- [x] Integration: 52 passed, including 24 Catalog cases and lock/rollback tests
- [x] Browser: 10 passed across desktop/mobile, including four Catalog cases
- [x] Loading/empty/error states, staff/member permissions and stale-edit recovery
- [x] No real credentials, tokens or personal-data dumps committed; logs checked for DB URI/JWT patterns
- [ ] Another member reviewed the change

Evidence: docs/submission/tu/logs/, docs/evidence/catalog-*.png and docs/submission/tu/VALIDATION.json. Local results do not establish GitHub CI or production readiness. Faculty template/instructor metadata and the members' own English recording remain group follow-up work.
