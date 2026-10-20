# Catalog validation milestone

Date: 2026-10-20 (Asia/Ho_Chi_Minh)
Environment: contributor Windows machine, local PostgreSQL and development servers.

## Reported results

- Source checks previously passed: lint, typecheck, build, unit/component tests,
  OpenAPI validation and formatting.
- Unit/component tests: 56 server and 24 client passed.
- PostgreSQL integration tests: 67 passed.
- Playwright E2E: 12 passed in 6.0 seconds.

## Browser coverage

Six test scenarios ran under each of two Playwright projects:
Chromium desktop and mobile viewport emulation.

- Catalog searches and filters real seeded books.
- Catalog opens details and displays live API availability.
- Catalog paginates and displays an empty search.
- Swagger loads the actual OpenAPI contract.
- Frontend connects to the real API.
- Connection failure is visible and can recover.

These results were copied from actual contributor terminal output.
Mobile coverage uses Chromium emulation, not a physical phone.

## Remaining verification

Staff forms and authenticated browser workflows are not implemented yet.
Archive-versus-borrow concurrency awaits integration with Loans.
Broader accessibility, responsive review and screenshots remain pending.

## Postman Public verification

Date: 2026-10-20. Contributor confirmed all eight Public requests
returned the expected statuses in Postman desktop:

- Categories, books, search and detail: 200.
- Conditional GET after saving ETag: 304.
- Availability: 200.
- Invalid page: 400.
- Guest archived listing: 403.

Staff collection execution remains pending Auth integration.
