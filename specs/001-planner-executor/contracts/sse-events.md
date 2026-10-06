# SSE events: plan runs

Transport: existing `GET /api/sessions/:sessionId/turns/:turnId/stream` (`text/event-stream`, seq in `chat_turn_chunks`).

Existing events (`llm_start`, `reasoning_delta`, `text_delta`, `tool_call`, `tool_result`, …) still fire **inside** an agent task. UI scopes them to `taskId` when present in the payload.

## New event types

### `plan_published`

Emitted after a valid DAG is stored (first plan or replan).

```json
{
  "planId": "uuid",
  "version": 1,
  "goal": "Add authentication",
  "status": "running",
  "tasks": [
    {
      "id": "inspect",
      "description": "…",
      "executor": "agent",
      "dependencies": [],
      "status": "pending"
    }
  ]
}
```

### `task_updated`

```json
{
  "planId": "uuid",
  "taskId": "inspect",
  "status": "running",
  "attemptCount": 1,
  "waitReason": null,
  "error": null
}
```

Statuses: `pending` | `running` | `waiting` | `completed` | `failed` | `cancelled`.

### `plan_status`

```json
{
  "planId": "uuid",
  "status": "waiting",
  "version": 1,
  "queuedFollowUp": { "text": "also add rate limits" }
}
```

### `budget_updated`

```json
{
  "workingMs": 40000,
  "llmTokens": 12000,
  "costUsd": 0.2,
  "stopReason": null
}
```

`stopReason` is `time` | `tokens` | `cost` when the run stops for budget.

### `followup_queued`

```json
{ "textPreview": "also add rate limits", "replaced": true }
```

### `replan`

```json
{ "fromVersion": 1, "toVersion": 2, "reason": "missing jwt dependency" }
```

Followed by `plan_published` for version 2.

### `merge_conflict`

```json
{
  "originatingTaskIds": ["edit-fe", "edit-be"],
  "paths": ["src/auth.ts"],
  "resolverAttempt": 1,
  "status": "resolving"
}
```

`status` is `resolving` | `waiting_human` | `merged`. Resolver attempts, tests, and diffs are in the task trace (`task_updated` + tool events scoped to the resolver `taskId`).

## UI mapping

- Plan card binds to `plan_published` + `task_updated` + `plan_status`.
- Queue banner binds to `followup_queued` / `plan_status.queuedFollowUp`.
- Ask-user widgets include `taskId` when the wait is in-plan.
