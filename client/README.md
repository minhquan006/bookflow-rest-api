# BookFlow client

React + TypeScript + Vite. Use Node.js 24.19.x and npm 11.x; install exact locked dependencies with `npm ci`.

```bash
cd client
npm ci
npm run dev
```

Vite listens on port 5173 and forwards `/api` requests to the API on port 3000. Start the server as described in the root README. The example `VITE_API_BASE_URL=/api/v1` is the default; copying `.env.example` is optional. Values prefixed with `VITE_` are public browser configuration and must never contain credentials. Development and the Nginx deployment both use the same origin for API calls.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run test:watch` starts interactive Vitest. Unit and component tests exercise the real HTTP client, API failures, cancellation, retry controls and accessible form/pagination boundaries. Root browser smoke tests are separate.

## Shared code

- `src/lib/http.ts`: `createApiClient`, `ApiError` and `ProblemDetails`. Use `request<T>(path, { json, method, signal })` for JSON requests; a `204` response resolves to `undefined`, so use `request<void>` for those operations. API paths are relative to the configured base. Read error codes and request IDs from `ApiError.problem`.
- Use `requestWithMetadata<T>` when a feature needs response status or headers such as `ETag`/`Location`. It returns `{ data, status, headers }`; `304` has no data, so retain the feature's previous representation. Pass `If-Match`/`If-None-Match` through request headers. The shared client does not maintain a cache.
- A feature may create its own client with `getAccessToken: () => tokenInMemory` to send the current bearer token. Never put access tokens in local storage. The client defaults to `credentials: "same-origin"`, preserves AbortError and never automatically retries a failed request or refreshes authentication.
- `src/components/`: Button with pending/disabled state, Feedback with accessible announcements, FormField with label/error association, and Pagination with boundary/empty states. Button and Feedback are used in the foundation screen; form and pagination primitives are available for the first feature forms/lists.
- `src/index.css`: shared color/spacing primitives, responsive shell, visible focus and reusable component styles. Use CSS Modules for feature-specific styles.
- `src/App.tsx`: foundation overview with a real API connection check. Catalog, Borrowing and Accounts navigation explicitly shows planned modules; it does not implement authentication, permissions or business workflows. Server authorization remains required for every protected endpoint.

Add business UI under `src/features/<module>/` and keep application composition under `src/app/` when routing/providers are introduced. Create files when they have a concrete responsibility. Do not import backend source or SQL into the browser. Keep API DTOs aligned with `docs/openapi.yaml`.
