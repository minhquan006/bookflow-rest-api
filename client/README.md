# BookFlow frontend

The client uses React, TypeScript and Vite. It provides the public catalog,
member circulation screens, staff catalog/return management and administrator
user/audit screens in English and Vietnamese.

## Run locally

Use Node 24.19.0 and npm 11. Follow the [root setup guide](../README.md) to install
all packages, configure the application and prepare PostgreSQL. The normal entry
point is `npm run dev` from the repository root; it starts both API and client.

For a client-only process, with a configured API already running:

```bash
npm --prefix client run dev
```

The default web/API ports are 5173/3000. The shared root configuration controls
Vite's strict port and its proxy for `/api`, `/docs`, `/openapi.yaml` and `/health`.
Swagger uses the relative `/docs/` link. See
[development profiles](../docs/DEV_PROFILES.md) for alternate ports.

`VITE_API_BASE_URL` defaults to `/api/v1`. All `VITE_*` values are public and must
not contain credentials. `npm --prefix client run preview` previews a built client;
it does not start PostgreSQL or the API and is not a substitute for the full stack.

## Structure

| Path              | Responsibility                                                       |
| ----------------- | -------------------------------------------------------------------- |
| `src/main.tsx`    | React entry point and stylesheet loading                             |
| `src/App.tsx`     | Language and authentication providers                                |
| `src/app/`        | Page routing, viewer guards, shared layout and browser history       |
| `src/features/`   | Home, authentication, users, catalog, loans and administration       |
| `src/components/` | Shared buttons, fields, feedback, language selector and pagination   |
| `src/lib/`        | HTTP requests, navigation, error mapping, dates and pagination types |
| `src/i18n/`       | Language context, persistence and Vietnamese translations            |
| `src/styles/`     | Base, shared component and layout styles                             |
| `tests/`          | Component, request handling, navigation and state regression tests   |

Feature DTOs and feature-specific CSS stay with their feature. `src/styles/index.css`
loads styles in a defined order; keep that order when changing shared styles.

## Requests and session state

`src/lib/http.ts` provides `createApiClient`, `ApiError` and request metadata.
Responses with 204 or 304 have no replacement data; a feature keeps its cached
representation for 304. Mutations are not automatically retried.

The authentication provider owns the memory-only access token, cookie-based
session restoration, refresh and logout. It composes recovery for protected GET
requests; the generic HTTP client does not refresh sessions itself. Cross-tab
coordination uses Web Locks and an opaque `bookflow.session.revision` marker.
Authentication requires writable site storage and localhost or HTTPS. Unsupported
coordination produces feedback while public browsing remains available.

Language changes preserve the current viewer and feature drafts. Identity or role
changes clear the previous viewer's state; late responses cannot restore it.
Backend role and ownership checks remain the security boundary. Keep DTOs aligned
with OpenAPI and do not import backend source into the frontend.

## Validation

Run from the repository root:

```bash
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix client test
npm --prefix client run build
```

Before integrating source changes, run the root `npm run check` and relevant
Playwright flows. See [language behavior](../docs/LANGUAGES.md) and
[recorded validation](../docs/SOURCE_FINALIZATION.md) for scope.
