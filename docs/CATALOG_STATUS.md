# Catalog integration status

The existing Catalog implementation and history from `feat/catalog` at `1bdf367`
are retained. Authenticated client integration, staff category/book/copy forms,
archive/version-conflict handling and advanced detail pages are now added.
See [current validation](CATALOG_VALIDATION.md) for actual checks on the merged
source. Borrow/return is delivered separately with Loans. Until that integration,
book details show availability without borrowing controls, and the navigation and
account screen do not offer My loans. Guest/member component tests and authenticated
desktop/mobile browser tests cover this boundary.

The following is the historical status recorded on Tú’s branch before integration.

# Catalog implementation status

Status on feat/catalog after the archived-listing increment.

## Implemented backend

- Categories: public paginated listing; staff create, replace and delete.
- Category deletion is blocked while active or archived books reference it.
- Books: listing, search, category filtering, sorting and pagination.
- Staff may include archived books; public/MEMBER requests cannot.
- Book details: visibility checks, metadata ETag and conditional GET.
- Availability: current count excluding unavailable copies and open loans; no-store.
- Staff book creation with category/ISBN validation.
- Staff PUT/PATCH metadata with atomic version checks and If-Match.
- Staff DELETE archives books, preserves history and blocks active loans.
- Staff copies: paginated listing, creation and condition updates.
- Copy condition changes are blocked while borrowed.
- Mutations and their audit records share transactions.

## Implemented frontend

- Public Catalog with search, category filter, sorting and pagination.
- Loading, empty and error states, retry and request cancellation.
- Expandable book details and live availability refresh.

## Verification

- Latest integration run: 67 tests passed against dedicated PostgreSQL test schemas.
- Includes HTTP/JWT/RBAC, validation, uniqueness, audit and rollback checks.
- Concurrent metadata writes using one version have exactly one winner.
- Concurrent metadata update/archive using one version has exactly one winner.
- Latest previously reported unit/component counts: 56 server and 24 client.
- Manual public search/filter/pagination API checks passed.
- Catalog listing was confirmed visible by the contributor.
- Public book-detail interactions passed automated browser E2E checks.

## Remaining work

- Integrate shared frontend Auth state and authenticated HTTP client.
- Staff forms for categories, books and copies.
- Edit UI must preserve input and handle 412 by loading the current version for review.
- Staff UI for archived books and archive confirmation.
- Update Postman collection for implemented Catalog operations.
- Staff browser E2E, broader responsive/accessibility review and screenshots.
- Integrate with Loans and test archive-versus-borrow concurrency.
- Prepare Catalog/API-contract report, REST/GraphQL/SOAP comparison and demo.

OpenAPI implementation markers describe backend operations, not completed staff UI.
The blueprint describes the target design; it is not evidence that all work is complete.

## Public browser verification

- Playwright: all 12 desktop/mobile-emulation runs passed.
- Evidence: docs/evidence/CATALOG_VALIDATION.md.
- Authenticated staff browser workflows remain pending.
