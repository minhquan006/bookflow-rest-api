# Tú — English speaking script (~6 minutes)

Target segment: six minutes. Rehearse at approximately 125–145 words per minute; timings are targets, not a claim about a recorded voice.

## Slide 1: BookFlow: Catalog and API Contract — target 25s

My part of BookFlow is the Catalog and its API contract. I will explain why we chose a resource-oriented HTTP API, how Categories, Books and Copies are modeled, and how the UI handles real failures. The implementation uses React, Express and PostgreSQL. The evidence shown here is from executed local checks, rather than claims about features that are still planned.

## Slide 2: Model the physical library, not just a list — target 30s

A title is different from an individual physical copy. Several copies can share book metadata, while each copy has its own barcode and condition. This separation lets us calculate availability without duplicating title information. Requests pass through a controller, a service and a repository. The service owns the transaction and writes the audit entry using the same database client as the mutation.

## Slide 3: REST, GraphQL and SOAP: compare the same task — target 55s

These approaches are not identical kinds of standard. REST is an architectural style. GraphQL specifies a typed query language and execution model. SOAP specifies an XML messaging framework. For a book card, our REST endpoint returns a defined book representation. A GraphQL design could let the client request only title, author and category name, but would still need authorization and bounded query execution. A SOAP design could define a GetBooks operation and its XML contract. We chose HTTP resources because the team can demonstrate clear methods, statuses, validation and OpenAPI tooling. This is a qualitative comparison: we did not build equivalent GraphQL and SOAP servers or measure their speed. REST does not require JSON, and SOAP is not limited to HTTP.

## Slide 4: A contract the browser can use — target 40s

The contract is more than a list of URLs. Creating a book requires all writable metadata, rejects unknown fields and returns status 201 with a Location and an ETag. PUT requires the complete editable representation, while PATCH accepts an allowed nonempty subset. Deleting a book archives it and returns 204. Errors use Problem Details with a request ID, so the client and logs can refer to the same failure. OpenAPI distinguishes implemented endpoints from planned ones, and the Postman collection provides concrete request examples.

## Slide 5: Public UI and staff access — target 35s

A visitor can search by title, author or ISBN, filter by category and choose a sort order. The server maps sort names to fixed SQL columns, and all user values are parameters. The page shows loading, empty and retry states. Staff sign-in exposes management forms, but hiding buttons is only a user-interface choice: the API independently verifies the token and reads the current role and status from the database. A member calling a staff mutation receives 403.

## Slide 6: Demonstrate a real management flow — target 50s

In the live Catalog, I first create a category and then a book that references it. Next I add a copy with a unique barcode. The initial condition is AVAILABLE. Changing it to MAINTENANCE reduces the available count; restoring it increases that count. Availability also excludes copies with an open loan. If I try to reuse the barcode, the server returns 409 and the UI keeps the error visible. These are real HTTP and database operations. The rehearsal uses an isolated test schema, so it does not change our development data.

## Slide 7: Two editors: detect a stale version — target 45s

A book’s metadata version becomes a strong ETag. When a form saves, it sends that value in If-Match. Inside a transaction, the service locks the book row, checks the version and updates the metadata. If another request has already saved, the old form receives 412 instead of overwriting the newer data. Missing If-Match receives 428. I demonstrate this by changing the book through a second real API request while the first form is open. The UI then asks me to reload before saving again.

## Slide 8: Protect history and open loans — target 35s

Archiving hides a book from public access while retaining its copies and historical relationships. A category referenced by an active or archived book cannot be deleted. An open loan blocks archiving and changing the condition of its copy. The Catalog locks the relevant book or copy before checking loans. The future Loans service must follow the same lock order. Our database tests simulate a competing borrower and verify that the Catalog waits, then rejects an unsafe change. Audit failures also roll back the mutation.

## Slide 9: Evidence: separate local checks from CI — target 30s

The recorded validation has 121 passing tests: 59 foundation tests, 52 integration tests and 10 browser tests. Twenty-four integration cases specifically cover the Catalog. The browser cases run on desktop and mobile and exercise real creation, editing, copy conditions, archive and error recovery. Integration tests use independent schemas in a test database. These are local results. I do not describe them as GitHub CI, a production deployment, a performance benchmark or proof that the Loans module has been completed.

## Slide 10: Integration and remaining group work — target 15s

This completes the Catalog contribution, not the entire group submission. We still need to integrate the other modules, apply the official Faculty template and record all three members speaking English within twenty minutes. The editable slides, report chapter, source and test evidence are ready for that group review.
