# BookFlow client

React + TypeScript + Vite. Use Node 24.19.0 and npm 11. Install dependencies
from the repository root with npm ci and npm run deps; start the API and
client as described in the [root README](../README.md).

Default dev uses frontend 5173 and proxies /api to API 3000. On Quân's Mac,
BookFlow uses frontend 5174 and API 3100 with the existing local helper;
PostgreSQL uses 5433. Keep these local settings until configuration task T1
is implemented. The current dev Swagger link still assumes API 3000.

VITE_API_BASE_URL defaults to /api/v1. VITE variables are public browser
configuration and must not contain credentials. Access tokens remain in memory;
refresh/CSRF cookies are handled by the Auth provider and backend.

## Implemented screens

- Authentication, account and administrator user management.
- Public catalog and book details; staff categories, books and physical copies.
- Member/staff loans, staff dashboard and administrator audit viewer.
- English/Vietnamese selector and language preference persistence.

The language-state fix, its remaining acceptance checks and outstanding cross-tab
session work are recorded in
[the quality improvement plan](../docs/QUALITY_IMPROVEMENT_PLAN.md).

## Shared implementation

- src/lib/http.ts provides createApiClient, ApiError and request metadata.
  A 204/304 has no data; features retain their cached representation for 304.
  Mutations are not automatically retried.
- src/features/auth/AuthContext.tsx manages the memory-only access token,
  session restoration, refresh and logout. Protected GET recovery is composed
  here; the underlying generic HTTP client does not refresh sessions itself.
- src/components supplies shared buttons, fields, feedback and pagination.
- src/App.tsx composes the language and authentication providers around AppRouter.
- src/app/AppRouter.tsx selects pages and applies UI access guards; AppLayout.tsx
  owns the shared shell and navigation; usePath.ts handles browser history.
  Backend authorization and ownership checks remain required for every protected operation.
- src/features/home/HomePage.tsx owns the overview and API connection status.
- src/lib/errors.ts, datetime.ts and pagination.ts contain shared error mapping,
  date formatting and paginated response types. Feature DTOs stay in their feature.
- src/styles/index.css loads base, shared component, layout and feature styles in
  a fixed order. Keep feature-specific selectors beside the feature.
- src/i18n supplies language context and translations. Do not translate stored
  book/user content or use translated labels as state identity.

Keep API DTOs aligned with OpenAPI. Do not import backend source into the browser.

## Checks

From the repository root, source changes require npm run check; relevant UI
changes require the applicable root Playwright tests. Client-only commands are:

```bash
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix client test
npm --prefix client run build
```
