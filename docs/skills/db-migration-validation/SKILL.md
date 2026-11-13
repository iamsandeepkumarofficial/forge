---
name: db-migration-validation
description: >-
  Apply and validate Forge Drizzle Postgres migrations under packages/db.
  Use when adding hand-written SQL migrations, updating meta/_journal.json,
  running pnpm --filter @forge/db db:migrate, or confirming columns landed.
---

# DB migration & validation (Forge / Drizzle)

## Critical rule

`drizzle-kit migrate` applies migrations listed in
`packages/db/migrations/meta/_journal.json` — **not** every `.sql` file in
`packages/db/migrations/`.

A new SQL file alone is skipped until it has a matching journal entry.

## Add a hand-written migration

1. Add SQL under `packages/db/migrations/`, e.g. `0022_task_io_contracts.sql`.
   - Tag = filename without `.sql` (e.g. `0022_task_io_contracts`).
   - Use `--> statement-breakpoint` between statements when needed.
2. Append an entry to `packages/db/migrations/meta/_journal.json`:

```json
{
  "idx": 22,
  "version": "7",
  "when": 1785900000000,
  "tag": "0022_task_io_contracts",
  "breakpoints": true
}
```

- `idx` = next integer after the last entry.
- `tag` must match the SQL basename.
- `when` = monotonic timestamp (follow prior entries’ style).

3. Prefer this hand-write + journal pattern for Forge schema changes. Use
   `pnpm --filter @forge/db db:generate` only when intentionally generating
   from Drizzle schema diffs.

## Apply

```bash
pnpm --filter @forge/db db:migrate
```

- Config: `packages/db/drizzle.config.ts` (`out: "./migrations"`).
- Credentials: `DATABASE_URL` from repo root `.env`, then `packages/db/.env`
  (override). Default:
  `postgresql://postgres:postgres@localhost:5433/forge`.
- Desktop / second Postgres may use a different port (e.g. `5432` vs `5433`).
  Migrate against the same URL the app uses.

## Validate

### 1. Migrate output

Command should apply the new tag (or no-op cleanly if already applied).

### 2. Journal recorded in DB

```bash
psql "${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/forge}" -c \
  "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

Expect a new row with the latest `created_at` for the migration just applied.

### 3. Schema / columns

```bash
psql "${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/forge}" -c \
  "SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = '<table>'
     AND column_name IN ('<col1>', '<col2>')
   ORDER BY column_name;"
```

Confirm expected types and defaults from the SQL file.

### 4. Smoke

Hit a code path that reads/writes the new columns. “column does not exist”
means wrong DB URL or migrate not applied on that instance.

## Checklist

- [ ] SQL file present under `packages/db/migrations/`
- [ ] Matching `tag` entry in `meta/_journal.json`
- [ ] `pnpm --filter @forge/db db:migrate` against the app’s `DATABASE_URL`
- [ ] New row in `drizzle.__drizzle_migrations`
- [ ] Columns/types verified via `information_schema`
