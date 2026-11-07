# Interface languages

BookFlow supports English and Vietnamese through the header's **Language /
Ngôn ngữ** selector. English is the default for a new browser. The selection is
stored as `bookflow.language` and restored after reload. If storage is unavailable,
switching still works for the current visit.

## User-visible behavior

Translations cover navigation, authentication, catalog/category/copy management,
loans and return confirmation, dashboard, users, audit filters, pagination,
accessibility labels and known validation/error messages. Dates use the selected
locale with Vietnam's UTC+7 timezone.

Changing language preserves the current session, applied catalog query, page size,
search draft and book/copy form drafts. It does not submit a form or repeat a
mutation. Identity or role changes clear the previous viewer's protected state;
a late response cannot restore that state. See
[implementation status](IMPLEMENTATION_STATUS.md) and
[source validation](SOURCE_FINALIZATION.md) for recorded scope.

Book titles, descriptions, category names, user names and emails remain as stored.
API field names, enum values, resource IDs and audit action codes remain canonical.
The OpenAPI contract stays in English. Unknown API error details remain visible
rather than being replaced with a misleading translation.

## Maintenance

- `client/src/i18n/LanguageProvider.tsx` owns selection and persistence.
- `client/src/i18n/language.ts` provides context and translation helpers.
- `client/src/i18n/vi.ts` contains the Vietnamese dictionary; English messages
  serve as typed translation keys.
- Use complete messages with named placeholders. Do not concatenate translated
  sentence fragments or translate stored book/user content.
- Store canonical feedback and timestamps in state so existing feedback updates
  when the language changes. Use `formatLibraryDate` from `client/src/lib/datetime.ts`
  for display and preserve API timestamps.
- Use stable user IDs and canonical roles for viewer identity, never translated labels.

## Validation

Run `npm run check` and relevant `npm run test:e2e` flows after UI changes.
Component tests cover persistence, unavailable storage, form preservation,
feedback, interpolation and dates. Browser flows cover language changes, reload,
registration and circulation with the API. Mobile cases use Chromium emulation;
these results do not establish support for every browser or physical device.
