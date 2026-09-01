# Architecture

**Phase:** 1 — Foundation

## Layering

```
app/ (Expo Router screens)
  └── components/ui/ (Screen, Button, Card, EmptyState)
        └── providers/DatabaseProvider
              └── repositories/
                    └── db/ (SqlDatabase adapter + migrations)
```

Screens never execute raw SQL. All persistence goes through typed repositories.

## Database Lifecycle

1. `DatabaseProvider` opens the database once on mount via `openAppDatabase()`.
2. `createDatabaseFromClient()` enables `PRAGMA foreign_keys = ON`.
3. `runMigrations()` applies pending migrations using `PRAGMA user_version`.
4. Repository instances are memoized and exposed via `useDatabase()`.

There is a single shared opening path — no concurrent independent bootstrap.

## Migration Strategy

- Forward-only numbered migrations (`001_initial.ts`, `002_…`, …).
- Each migration runs inside a transaction; `user_version` is bumped atomically.
- Never edit published migrations — add new files instead.
- Tests use sql.js with the same `createDatabaseFromClient()` path.

## Domain Decisions

- UUID/text IDs for backup/restore stability.
- ISO-8601 UTC timestamps for persistence.
- English enum values in DB (`knitting`, `active`, …); UI localizes later.
- Domain validation in `src/domain/validation.ts` before writes.

## Schema Version

Current: **1** (`CURRENT_SCHEMA_VERSION` in `src/db/migrations/index.ts`)

Tables: `app_settings`, `knitting_projects`, `project_parts`, `counters`, `counter_events`

## Counter Atomicity

`CounterRepository.incrementCounter()`, `decrementCounter()`, and `setCounterValue()` update the counter and insert a `counter_events` row inside a single transaction.

## Error Handling

- `StorageError` — database failures
- `DomainValidationError` — business rule violations
- `DatabaseProvider` surfaces init errors via a lightweight gate UI (no raw stack traces to users)
