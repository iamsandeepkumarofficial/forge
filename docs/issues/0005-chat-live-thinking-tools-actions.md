# 0005: Chat live thinking vanishes, tools duplicate, actions on every LLM step

- **Status:** Fixed
- **Date:** 2026-09-11
- **Severity:** Transcript looks broken mid-turn; Copy/Branch/⋯ spam
- **Related QA:** Temporal turn with no live progress (`docs/qa-backlog.md`)

## Summary

Each orchestrator round emits `llm_start`, which **cleared** live reasoning, text, and tool parts. Thinking that had already streamed disappeared until a full refresh reloaded persisted parts.

The same live `tool_call` events were also rendered on top of history that already contained those invocations, so `preview_start` (and other tools) appeared twice.

Copy, Branch, and ⋯ were attached to **every persisted assistant row**. One user prompt persists several assistant messages (one per LLM round with tools), so the actions showed on each tool/LLM block instead of once per run.

## Repro

1. Run a turn that thinks, then calls tools, then thinks again — live thinking vanishes on the next `llm_start`; refresh brings it back.
2. `preview_start` once — two “Starting preview” rows in the transcript.
3. After the turn completes, hover each tool/LLM block — Copy/Branch/⋯ on all of them.

## Fix

- **Commit live steps:** On `llm_start`, snapshot the current live text/reasoning/tools into `committedSteps` instead of dropping them (`committed-turn-step.ts`, `use-chat-pane-session-state.ts`).
- **Dedupe:** Skip live tool parts whose `toolCallId` is already in history (`excludeKnownToolParts`).
- **Per-run actions:** Group user → following assistant messages as one run; show Copy/Branch/⋯ once at the end of a **completed** run (`chat-run-actions.ts`). Copy concatenates that run’s assistant text; Branch uses the last persisted assistant id. Hide actions on the in-progress last run while streaming.

## Key files

| Area           | Path                                                               |
| -------------- | ------------------------------------------------------------------ |
| Step snapshot  | `apps/web-ui/src/routes/chat-workbench/committed-turn-step.ts`     |
| Stream handler | `apps/web-ui/src/routes/chat-workbench/chat-pane-stream-events.ts` |
| Run actions    | `apps/web-ui/src/routes/chat-workbench/chat-run-actions.ts`        |
| List           | `apps/web-ui/src/routes/chat-workbench/chat-message-list.tsx`      |
| Merge tools    | `apps/web-ui/src/lib/tool-display.ts`                              |

## Related polish in the same batch (not this issue’s core)

Activity rows (verb labels, hover chevron), Ask User stacked MCQ + Skip/Close + Other, centered session title, header chips removed, dock Terminal pinned with closeable extra tabs, batched `upsert_workspace_parameter`.

## Regression risks

- Clearing live reasoning/tools on `llm_start` without committing a step.
- Rendering live tool parts that already exist on persisted assistant messages.
- `showActions` on every assistant id (`local-*` excluded is not enough — must be last assistant of the run).
