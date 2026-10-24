# Website languages

BookFlow offers English and Vietnamese through the **Language / Ngôn ngữ** selector
in the header, including on mobile. English remains the default on a new browser.
Choosing **Tiếng Việt** changes the current interface immediately; choosing **English**
switches it back. The preference is saved as `bookflow.language` in localStorage and
restored after reload. No authentication data is written to browser storage. If
storage is unavailable, switching still works for the current visit.

The translation covers navigation, public pages, authentication, account and user
administration, catalog/category/copy management, loans/returns, dashboard, audit
filters, pagination, accessibility labels and known error/validation messages.
Changing language preserves the session, current form input, filters and page.
Library dates use the selected locale and always retain Vietnam's UTC+7 timezone.

Book titles, descriptions, category names, user names and emails remain exactly as
stored. API field names, enum values, resource IDs and audit action codes stay
unchanged. Swagger/OpenAPI remains the English API contract. Unrecognized API error
details remain visible in their original language rather than losing diagnostic
information.

## Maintenance

`client/src/i18n/LanguageProvider.tsx` owns language selection and persistence.
`client/src/i18n/language.ts` provides the context and translation helpers. `client/src/i18n/vi.ts` contains the Vietnamese dictionary;
English source messages serve as typed keys for `t`. Use complete messages with
named placeholders instead of concatenating translated fragments. Use `translate`
only for known canonical messages or status labels coming from state/API helpers;
never pass book or user content to it. Store canonical messages or timestamps in
state so existing feedback also updates when the language changes. Pass the chosen
locale to `formatLibraryDate`; do not change timestamps sent to the API.

## Validation

Run `npm run check` and `npm run test:e2e` with the seeded database. The language
component tests cover persistence, unavailable storage, unsupported preferences,
form preservation, existing API errors, interpolation and localized dates. Browser
tests exercise language switching/reload and registration form validation on both
screen sizes. The borrowing/return flow runs in Vietnamese on mobile and English
on desktop, with real API, database, dashboard and audit assertions.
