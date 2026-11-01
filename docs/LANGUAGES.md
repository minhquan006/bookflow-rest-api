# Website languages

BookFlow offers English and Vietnamese through the **Language / Ngôn ngữ** selector
in the header, including on mobile. English remains the default on a new browser.
Choosing **Tiếng Việt** changes the current interface immediately; choosing **English**
switches it back. The preference is saved as `bookflow.language` in localStorage and
restored after reload. No credentials or profile data are written to browser storage; the session
coordinator stores only an opaque revision marker. If
storage is unavailable, switching still works for the current visit.

The translation covers navigation, public pages, authentication, account and user
administration, catalog/category/copy management, loans/returns, dashboard, audit
filters, pagination, accessibility labels and known error/validation messages.
Changing language keeps the session. AppRouter now uses the user ID and canonical
role in React keys, preserving Catalog filters and book-detail drafts when language
changes. App tests cover search/category/sort/page, create/edit/barcode drafts and absence
of language-triggered mutations. Identity/role changes clear the previous viewer's
drafts; background restoration preserves typed sign-in credentials. Browser tests
exercise the same language matrix with the real API. See
[Quân's validation](QUAN_VALIDATION.md) for the exact workspace and results;
peer review remains tracked in [the improvement plan](QUALITY_IMPROVEMENT_PLAN.md).
Other outstanding language work includes untranslated return instructions in
loan rows (A2). The existing test evidence does not establish full coverage.
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
locale to `formatLibraryDate` in `client/src/lib/datetime.ts`; do not change
timestamps sent to the API.

## Validation

Run `npm run check` and `npm run test:e2e` with the seeded database. The language
component tests cover persistence, unavailable storage, unsupported preferences,
form preservation, existing API errors, interpolation and localized dates. Browser
tests exercise language switching/reload and registration form validation on both
screen sizes. The borrowing/return flow runs in Vietnamese on mobile and English
on desktop, with real API, database, dashboard and audit assertions.
