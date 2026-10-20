# Catalog implementation status

## Implemented on feat/catalog

- GET /api/v1/categories: public category listing with pagination.
- GET /api/v1/books: public active-book listing, title/author search,
  category filtering, allowlisted sorting and pagination.
- Catalog UI: search, category filter, sorting, pagination,
  loading, empty and error states, retry and request cancellation.

## Verification

On the contributor's Windows development machine:

- npm run check passed: 56 server tests and 21 client tests.
- Manual API checks passed against local PostgreSQL:
  title search, category filtering, no-match search and pagination.
- Categories page=0 returned HTTP 400.
- Catalog UI was confirmed to display books.

Service and component tests use mocks. These results do not establish
PostgreSQL integration-suite or browser E2E-suite success.

## Remaining work

- Staff access to archived books. Currently includeArchived=true is
  rejected for all callers; GET /books remains partially implemented.
- Book details and availability.
- Category/book mutations and copy management.
- Staff authorization integration.
- ETag / If-Match.
- Catalog database integration tests and browser E2E tests.
- Postman coverage for implemented Catalog operations.

The original blueprint describes the target scope, not completed work.

## Category creation verification

- POST /api/v1/categories is implemented for LIBRARIAN and ADMIN.
- Returns 201 with Location; validates input and rejects duplicate names/slugs.
- Category and audit insert commit together; audit failure rolls back category.
- JWT authentication checks current account role and status in PostgreSQL.
- Latest checks: 56 server tests, 21 client tests and 19 integration tests passed.
- Integration coverage includes 11 category service/HTTP tests and 8 foundation tests.
- Earlier verification notes above describe the previous browsing milestone.
- Category creation UI and browser E2E coverage remain pending.

## Book creation verification

- POST /api/v1/books is implemented for LIBRARIAN and ADMIN.
- Returns 201 with Location and a strong metadata ETag.
- Validates input and rejects client-supplied internal fields.
- Missing category: 400 INVALID_CATEGORY.
- Duplicate ISBN: 409 ISBN_ALREADY_EXISTS.
- Multiple books may have a null ISBN.
- Book and audit inserts share one transaction.
- Latest checks passed: 56 server, 21 client and 26 integration tests.
- Seven new HTTP integration tests cover book creation.
- Book creation UI, metadata updates and browser E2E remain pending.

## Book details and availability verification

- GET /api/v1/books/{id} is implemented with metadata ETag.
- Matching If-None-Match returns 304 with no body after visibility checks.
- Archived books are visible only to authenticated LIBRARIAN/ADMIN.
- GET /api/v1/books/{id}/availability returns current available copy count.
- Availability excludes open loans, MAINTENANCE and RETIRED copies.
- Availability responses use Cache-Control: no-store.
- Latest checks passed: 56 server, 21 client and 33 integration tests.
- Detail UI, metadata mutations, copy management and browser E2E remain pending.
- Earlier remaining-work lists describe their respective milestones.

## Copy listing and creation verification

- Staff can list copies with pagination and create copies with unique barcodes.
- New copies default to AVAILABLE; archived books reject new copies.
- Copy and audit insert share a transaction; audit failure rolls back the copy.
- Creating an available copy increases the live availability count.
- Latest checks passed: 56 server, 24 client and 40 integration tests.
- Copy status updates and staff management UI remain pending.
- Detail UI now exists with three component tests; browser E2E remains pending.

## Copy condition update verification

- PATCH /api/v1/copies/{id} is implemented for LIBRARIAN and ADMIN.
- Supports AVAILABLE, MAINTENANCE and RETIRED.
- Locks the copy before checking open loans and changing condition.
- A changed condition is rejected with 409 COPY_HAS_ACTIVE_LOAN if borrowed.
- Repeating the current condition succeeds without an extra audit.
- Returned-loan history is preserved when retiring a copy.
- Update and audit share a transaction; audit failure rolls back the update.
- Latest checks passed: 56 server, 24 client and 46 integration tests.
- Staff management UI and browser E2E remain pending.
