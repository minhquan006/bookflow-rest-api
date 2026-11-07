# System design

BookFlow uses a modular monolith: one Express API, one PostgreSQL database and a
React browser client. This page describes design decisions. Use
[implementation status](IMPLEMENTATION_STATUS.md) for delivered behavior and
[source validation](SOURCE_FINALIZATION.md) for recorded results. Earlier planning is available in Git history.

## Purpose and scope

The library workflow demonstrates resource-oriented HTTP, role and ownership
checks, conditional updates and transactions. The three application roles are
MEMBER, LIBRARIAN and ADMIN; visitors can browse the public catalog.

The core domain consists of categories, book titles, physical copies, users and
loans. Audit records and refresh-session records support traceability and
session management. Reservations, email reminders, OAuth login and a public
production deployment are possible extensions rather than release requirements.

## Boundaries

The browser displays data and handles interaction. The API enforces access and
business rules even when requests bypass the UI. Route handlers own HTTP,
services own transactions and repositories use parameterized SQL on the supplied
client. The browser does not import backend source or connect to PostgreSQL.

Frontend code is grouped by feature. Shared components, request handling,
navigation, dates and translations have separate modules. Stable user IDs and
roles identify the viewer; translated labels do not define component identity.

## Consistency

A title has multiple physical copies. An available copy must have a suitable
condition and no open loan. Borrowing coordinates user limits, overdue/duplicate
rules, copy allocation and audit writing inside one transaction. Database
constraints supplement service checks.

Book edits use a stored version, ETag and an If-Match precondition to reject
stale changes. A repeated return retains the original confirmation and does not
create another return audit event. Uncertain mutation results are surfaced for
user recovery rather than automatically repeated.

## Sessions and HTTP

Access tokens stay in memory. Refresh rotation, CSRF protection and cross-tab
coordination govern restoration and logout. Identity or role changes clear
protected client state and invalidate late responses from an earlier viewer.

OpenAPI describes the contract. Shared response/error handling, the resource
method registry and contract checks keep status codes and payloads consistent.
The system applies REST principles but does not claim full hypermedia compliance.

## Validation and operations

Unit/component tests, PostgreSQL integration tests, browser flows and container
smoke checks provide different kinds of evidence. Test databases end in `_test`;
services and fixtures preserve development data. Applied migrations are immutable.

Native development uses Vite as a proxy to the API. Docker uses Nginx for the
built client and service paths. Both run against the same application contract.
See the [architecture guide](README.md), [API contract](API_CONTRACT.md) and
[migration guide](../server/migrations/README.md) for implementation details.
