# Vietnamese interface validation

Validated on cloud at 2026-10-25T02:47:41.645357+07:00. Base: `main@7221e9e`.
Feature tree: `5f8a46f16af3f330d12774fb1c73a1c593496d61`. The patch is not merged into main.

- `npm run check`: passed; 66 server and 80 client tests, lint/typecheck/build/OpenAPI/format.
- Eleven pre-existing React lint warnings remain; the feature adds no lint warnings.
- `npm run test:e2e`: 24 passed on desktop/mobile (26.2 seconds).
- English desktop and Vietnamese mobile borrowing/return workflows use real API/DB.
- Public language switching, form drafts/validation, reload persistence and mobile overflow are covered.
- Patch application to the exact base was checked and reproduces the feature tree.
- No API/schema/migration/dependency changes. DB integration, Docker and benchmark were not rerun for this UI feature.

During development, a label association issue was fixed. An extra duplicated business
scenario also exceeded the existing 300-request/minute limiter. Coverage was combined
with the existing mobile business flow; application limits were kept unchanged. The
final 24-case suite passed without retries.

These are cloud results; the submitting member should run the documented checks on
their Mac before opening the PR. Only sanitized command logs are included, with no
raw browser traces, authentication data or local environment files.
