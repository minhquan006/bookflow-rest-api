# Database conventions

Run commands from `server/` after `npm run build`:

```sh
npm run db:migrate
npm run db:seed
```

Both commands read the server `.env` or exported variables. Migration requires
`DATABASE_URL`; demo seed additionally requires `NODE_ENV=development` (or `test`)
and `SEED_DEMO_PASSWORD` of 12–128 characters. Seed inserts three synthetic
accounts (`admin@bookflow.test`, `librarian@bookflow.test`,
`member@bookflow.test`), two categories, three books and six copies. It preserves
existing account passwords, roles and catalog records. Seed does not implement
login; the auth module must still be developed. Never use demo credentials in a
public deployment.

Add migrations as `NNN_descriptive_name.sql`, in ascending order. An applied
migration must never be edited or deleted: its SHA-256 checksum is recorded in
`schema_migrations`, and drift stops further migration. All pending migrations
run atomically under a PostgreSQL transaction advisory lock. Do not put
`BEGIN`, `COMMIT`, `CREATE INDEX CONCURRENTLY` or other transaction-incompatible
commands in migration files. There is intentionally no destructive down command.

When adding a migration, update `CURRENT_SCHEMA_VERSION` in
`src/db/migrate.ts` so readiness requires the new schema, and update DB tests and
the API contract in the same pull request. API readiness must return unavailable
until that version exists. Migration is a separate deployment step; API startup
does not apply schema changes.

Service code owns `withTransaction(pool, callback)`. Pass its `PoolClient` to
every repository operation inside the callback. Do not use `pool.query` inside
that transaction, commit in a child repository, or call external HTTP services
while holding row locks. The callback is not automatically retried; retry a whole
transaction only when the service has established a safe retry policy.

The schema protects unique normalized emails/categories, unique barcodes and
ISBNs, foreign-key history, valid loan dates, paired return confirmation, and one
open loan per physical copy. Availability is derived from copy condition and the
absence of an open loan. Borrowing limits, overdue blocking, same-title borrowing,
archive-versus-borrow locking, admin invariants and refresh rotation still require
service transactions and corresponding integration tests.

`npm run test:integration` requires a dedicated `TEST_DATABASE_URL` whose database
name ends in `_test`. Tests never use `DATABASE_URL`: they create a random isolated
schema, run migrations and seed, then drop only their own schema. The database
user therefore needs permission to create schemas in that test database.
