# Моя вязалка

Offline-first knitting assistant for Russian-speaking users.

**GitHub `main` is the source of truth.**

Repository: https://github.com/alex1c/knitCounterRuStore

## Current Phase

**Phase 2 — Projects + Core Knitting Counter** (create projects, count rows, undo, multiple counters)

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- Expo Router
- SQLite (expo-sqlite)
- Jest + sql.js (tests)

Android package: `com.calculatorplatform.knitcounter`

## Development Workflow

| Machine | Path |
|---------|------|
| Remote Cursor | `D:\PetProject\knitCounterRuStore` |
| Codex / local review | `D:\petProject\knitCounterRuStore` |

Before Codex review, pull current `origin/main` on the local machine.

Do not put machine-specific paths into runtime application code.

## Setup

```bash
npm install
```

Requires Node.js >= 20.19.4.

## Run

```bash
npm start
npm run android
```

## Tests & Quality

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
```

## Architecture

```
src/
  app/           Expo Router screens (5 tabs)
  components/ui/ Reusable UI (Screen, Button, Card, EmptyState)
  db/            SQLite adapters, migrations
  domain/        Types, codes, validation, errors
  repositories/  Typed data access
  providers/     DatabaseProvider
  theme/         Design tokens
  utils/         IDs, timestamps, numeric parsing
```

See `docs/ARCHITECTURE.md`, `docs/PRODUCT_SCOPE.md`, and `docs/DOMAIN_MODEL.md`.

## Database Migrations

- Schema version tracked via `PRAGMA user_version`
- Migrations in `src/db/migrations/` — forward-only, transactional
- Never edit published migrations; add new numbered files
- Current version: **1**

## Git Workflow

1. Work on feature branches or directly on `main` per team convention
2. Run all quality gates before push
3. Push to `origin/main` — GitHub is source of truth
