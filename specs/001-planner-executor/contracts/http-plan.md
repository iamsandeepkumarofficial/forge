# HTTP contracts: plan runs

Base: existing chat API on the tool-plane (`/api`). Auth unchanged (local user middleware).

## POST `/api/sessions/:sessionId/chat`

Start or queue a run.

### Request

```json
{
  "text": "Add authentication to this application",
  "mode": "agent",
  "provider": "openai",
  "model": "gpt-5",
  "reasoningEffort": "medium",
  "forceSend": false
}
```

`forceSend` default `false`.

### Responses

| Status | When                                  | Body                                                                    |
| ------ | ------------------------------------- | ----------------------------------------------------------------------- |
| 202    | New run started                       | `{ turnId, workflowId, streamUrl, planId }`                             |
| 202    | Run already active, `forceSend` false | `{ queued: true, turnId, planId }` — single-slot replace                |
| 202    | `forceSend` true                      | New `{ turnId, workflowId, streamUrl, planId }`; previous run cancelled |
| 400    | Empty text                            | `{ error }`                                                             |
| 404    | Session not found                     | `{ error }`                                                             |
| 503    | Temporal down                         | `{ error }`                                                             |

**Change from today:** a running turn no longer returns **409**. Queue or force-send instead.

Ask mode: 202 starts `interactiveChatTurnWorkflow` (no plan). Other modes start `interactiveAgentWorkflow`.

## GET `/api/sessions/:sessionId/turns/running`

```json
{
  "turn": {
    "id": "uuid",
    "workflowId": "agent-…",
    "status": "running",
    "plan": { "$ref": "WorkflowPlan snapshot" }
  }
}
```

`turn` is null if none active. Include plan snapshot when present (reload).

## GET `/api/sessions/:sessionId/plans/current`

Returns the latest plan for the session (running, waiting, or last terminal).

```json
{
  "plan": {
    "id": "uuid",
    "goal": "…",
    "status": "running",
    "version": 1,
    "replanCount": 0,
    "queuedFollowUp": null,
    "workingMs": 12000,
    "llmTokens": 8000,
    "costUsd": 0.12,
    "budget": {
      "maxExecutionTimeMs": 1800000,
      "maxLLMTokens": 500000,
      "maxCostUsd": 3.0
    },
    "tasks": [
      {
        "id": "inspect-fe",
        "description": "Explore frontend",
        "executor": "agent",
        "dependencies": [],
        "status": "running",
        "idempotent": true,
        "attemptCount": 1,
        "waitReason": null
      }
    ]
  }
}
```

404 if this session has never planned.

## POST `/api/sessions/:sessionId/turns/:turnId/answer`

Resume a waiting task (Ask-user, mode switch, approval).

```json
{ "taskId": "deploy", "payload": { "choice": "yes" } }
```

202 `{ ok: true }`. Signals Temporal `userAnswer`. 409 if that task is not waiting.

## POST `/api/sessions/:sessionId/turns/:turnId/cancel`

Unchanged: cancel parent + children; pending tasks do not start.

## GET `/api/sessions/:sessionId/turns/:turnId/stream`

Unchanged SSE transport (`chat_turn_chunks`). New event types listed in `sse-events.md`.
