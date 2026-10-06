# Quickstart: Planner / Executor

Validate against a running desktop Forge (Postgres + Temporal already required).

## Prerequisites

- `pnpm install` and a configured LLM key
- `pnpm desktop` (or `pnpm dev` + Temporal)
- A connected workspace with at least one repo (two members if you want cross-repo overlap)

## Quality gates (always)

```bash
pnpm typecheck
pnpm lint
pnpm test
```

New unit coverage to expect:

- DAG validate (cycle, missing dep, >20 tasks)
- Ready-set scheduler (caps 4 / 10)
- Retry vs replan vs non-idempotent skip
- Budget pause when idle, tick when a child is running
- Queue replace vs force-send discard

## Scenario A — P1 plan then execute

1. New chat, mode **Agent**.
2. Send: `Add a health endpoint and a unit test for it.`
3. **Expect:** structured plan card (goal + tasks) **before** source edits; statuses move pending → running → completed.
4. Mode **Ask**, send: `What does package.json name?`
5. **Expect:** no plan card.

## Scenario B — Plan mode waits

1. Mode **Plan**, same implementation request.
2. **Expect:** plan card, no source mutation.
3. Switch to **Agent** and continue.
4. **Expect:** same plan executes (or plans then executes if none).

## Scenario C — Parallel independents (P2)

1. Workspace with frontend + backend (or two modules).
2. Send a goal that inspects both, then implements.
3. **Expect:** two inspect tasks can be `running` at once; the dependent design/implement task stays pending until both complete.
4. If both mutate the same repo: nested worktrees merge in completion order before the dependent starts. If the merge is unclean: no half-merged tree; a same-kind resolver agent gets up to 2 attempts with tests in the trace; if it still fails, the plan waits on you with conflict paths preserved.

## Scenario D — Queue vs force send

1. Start a long Agent run.
2. Type a follow-up and send (default).
3. **Expect:** run continues; banner shows queued follow-up; no 409.
4. Send another follow-up.
5. **Expect:** queue slot replaced.
6. Click **Send now**.
7. **Expect:** current run cancels; new run starts with that text.

## Scenario E — Wait and resume (P4)

1. Trigger an `ask_user` / install approval inside a planned run.
2. **Expect:** that task `waiting`; independent already-running tasks may still run; idle wait does not burn the 30-minute cap.
3. Answer the widget (do not compose a new request).
4. **Expect:** same plan resumes; completed tasks stay completed.
5. Quit and reopen desktop.
6. **Expect:** same plan statuses.

## Scenario F — Retry vs replan vs budget (P3)

1. Force a test task to fail twice then succeed (idempotent) → still same task, `attemptCount` 3 max.
2. Missing-dependency style failure after attempts → `replan` event, version 2, kept completed work.
3. Third strategy miss after two replans → run failed with last plan visible.
4. (Optional) Lower caps in a test env to hit time/tokens/cost stopReason.

## If something fails

- Temporal not running: start with `pnpm temporal:dev` or desktop native stack.
- No plan card: check SSE `plan_published` on the turn stream and `GET .../plans/current`.
- 409 on send: queue path not wired; `forceSend` / `queueFollowUp` missing.
