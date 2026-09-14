# 0007: `POST /chat` fails with `column "rounds" does not exist`

- **Status:** Fixed (apply migration `0019_chat_turn_summary.sql`)
- **Date:** 2026-09-11
- **Severity:** Blocking — new interactive turns cannot finish / list
- **Related:** [RFC 0010](../rfcs/0010-interactive-chat-revert.md) (same `chat_turns` / `session_messages` evolution)

## Summary

Code started writing `chat_turns.rounds` (and related summary columns: `tool_call_count`, `tool_names`, `hit_round_cap`) before local Postgres had the migration. Drizzle schema and orchestrator `finishChatTurn` already expected the columns.

Desktop Forge may use a **second** Postgres (e.g. `127.0.0.1:5433`) that does not get `pnpm db:migrate` against `.env`’s `5432`. Both need `0019`.

`0020_chat_revert.sql` (`session_messages.deleted_at`, `chat_turns.workspace_checkpoint`) is in the same batch; apply it too. Branch / checkpoint **behavior** is still wrong — see `docs/tech-debt.md`.

## Repro

1. Run a workbench turn after pulling code that persists turn summaries.
2. `POST /api/sessions/:id/chat` (or internal finish) → `column "rounds" does not exist`.

## Fix

Migration `packages/db/migrations/0019_chat_turn_summary.sql` (`ADD COLUMN IF NOT EXISTS`). Apply to every Forge Postgres this checkout uses.

## Regression risks

- Adding columns to `packages/db/src/schema.ts` without a journaled SQL migration.
- Migrating only one of the local databases when desktop and `apps/server` `.env` disagree on port.
