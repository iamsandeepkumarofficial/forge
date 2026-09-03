---
name: DB migrations
description: Run Prisma, Drizzle, Knex, Alembic, or Django migrations using Forge DATABASE_URL and MONGODB_URI.
---

# DB migrations

Use when the app references `DATABASE_URL`, `MONGODB_URI`, Prisma, or ORM migrate scripts.

## Rules

- **Never** install Postgres/Mongo in the sandbox.
- Use env vars already injected: `DATABASE_URL`, `MONGODB_URI`.
- Run migrations via `run_terminal` in the member repo **before** `preview_start`.

## Node

| Tool | Command |
|------|---------|
| Prisma | `npx prisma migrate deploy` or `pnpm prisma migrate dev` |
| Drizzle | `pnpm drizzle-kit migrate` (per project scripts) |
| Knex | `npx knex migrate:latest` |
| TypeORM | `npm run typeorm migration:run` |

## Python

| Tool | Command |
|------|---------|
| Django | `python manage.py migrate` |
| Alembic | `alembic upgrade head` |

## Mongo

- Mongoose: seed scripts via `run_terminal` if documented in repo.
- No server install — connection string is `MONGODB_URI`.

## Hardcoded localhost

- If app uses `localhost:5432`, update config or env to use injected `DATABASE_URL` (postgres-apps host inside Docker network).

## Workspace

- Run migrations per member that owns the schema (usually backend repo first).
