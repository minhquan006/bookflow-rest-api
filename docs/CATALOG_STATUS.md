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
