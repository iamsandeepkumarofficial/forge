# Data model: Planner / Executor

## Entities

### WorkflowPlan

One durable plan for one chat turn (run). Identity equals the turn for v1 (`plan.id` may equal `chat_turns.id`).

| Field                | Type                 | Notes                                                                         |
| -------------------- | -------------------- | ----------------------------------------------------------------------------- |
| id                   | uuid PK              | Same as `chat_turns.id` unless a future run spans turns                       |
| sessionId            | text                 | Chat session                                                                  |
| turnId               | uuid FK → chat_turns | Cascade delete                                                                |
| workflowId           | text                 | Temporal parent workflow id (`agent-{sessionId}-{turnId}`)                    |
| goal                 | text                 | User goal                                                                     |
| status               | enum                 | `planned` \| `running` \| `waiting` \| `completed` \| `failed` \| `cancelled` |
| version              | int                  | DAG version; 1 = original; increment on replan (max 3 = original + 2)         |
| replanCount          | int                  | 0–2                                                                           |
| queuedFollowUp       | jsonb \| null        | Single slot `{ text, mode, provider, model, reasoningEffort }`                |
| workingMs            | int                  | Accumulated working time (excludes idle wait)                                 |
| llmTokens            | int                  | Sum of prompt+completion usage                                                |
| costUsd              | numeric(12,4)        | Estimated                                                                     |
| budgetStopReason     | text \| null         | `time` \| `tokens` \| `cost`                                                  |
| snapshot             | jsonb                | Last published graph for SSE/reload                                           |
| createdAt, updatedAt | timestamptz          |                                                                               |

**Invariants:** ≤20 tasks per version; at most one plan with status in (`planned`,`running`,`waiting`) per session.

### WorkflowTask

| Field                 | Type                | Notes                                                                         |
| --------------------- | ------------------- | ----------------------------------------------------------------------------- |
| id                    | text                | Stable within a plan version (planner id, e.g. `inspect-frontend`)            |
| planId                | uuid FK             | Composite PK `(planId, id, version)` or unique `(planId, version, id)`        |
| version               | int                 | DAG version this row belongs to                                               |
| description           | text                | Required                                                                      |
| executor              | enum                | `agent` \| `tool` \| `human`                                                  |
| dependencies          | text[]              | Task ids in the same version                                                  |
| status                | enum                | `pending` \| `running` \| `waiting` \| `completed` \| `failed` \| `cancelled` |
| idempotent            | bool                | Default false for mutating agent/tool; true for tests/compile/read            |
| waitReason            | jsonb \| null       | `{ kind: "ask_user"\|"mode_switch"\|"approval"\|"merge_conflict", payload }`  |
| input, output, error  | jsonb / text        | Summaries                                                                     |
| attemptCount          | int                 | 0–3 for normal tasks; resolver tasks 0–2                                      |
| childWorkflowId       | text \| null        | Temporal child id when running                                                |
| worktreePath          | text \| null        | Nested worktree if isolated                                                   |
| startedAt, finishedAt | timestamptz \| null |                                                                               |

**Invariants:** no cycles; every dependency id exists; dependents cannot start unless all deps `completed`.

### RunBudget (embedded on WorkflowPlan)

| Cap              | Default            | Accrual                            |
| ---------------- | ------------------ | ---------------------------------- |
| maxExecutionTime | 30 minutes working | Ticks while any child is running   |
| maxLLMTokens     | 500000             | LLM activity usage                 |
| maxCost          | 3.00 USD           | Estimated from token × price table |

Stop when any cap exceeded; persist `budgetStopReason`.

### Queued request (embedded)

At most one. Later normal send **replaces**. Force send **discards**. After terminal plan status, server starts a new turn from the queued body.

### In-session agent

Not a table. Materialized as a running `WorkflowTask` with `executor=agent` plus Temporal child `executeAgentTaskWorkflow`. Conflict-resolution is the same kind, spawned by the parent, max 2 attempts.

### Merge conflict (embedded on plan or waiting task)

| Field                | Notes                                      |
| -------------------- | ------------------------------------------ |
| originatingTaskIds   | Tasks whose worktrees collided             |
| paths                | Affected files                             |
| diffs                | Both sides + merge-base / combined diff    |
| resolverAttemptCount | 0–2                                        |
| testOutcomes         | Per attempt                                |
| status               | `resolving` \| `waiting_human` \| `merged` |

Session working tree is aborted back to last clean merge; artifacts live here, not in a conflicted index.

### Revision

`version` increment on the plan + new task rows for that version. Completed tasks copied forward unless the replan invalidates them (`invalidated: true` on the new version row).

## Relationships

```text
Chat session 1 ─── * ChatTurn
ChatTurn     1 ─── 1 WorkflowPlan
WorkflowPlan 1 ─── * WorkflowTask (per version)
WorkflowPlan 1 ─── * chat_turn_chunks (plan_published, task_updated, …)
```

## State transitions

### Plan

```text
planned → running
running → waiting     // no children in flight, at least one task waiting
waiting → running     // userAnswer or a sibling was still going (usually skip waiting)
running → completed | failed | cancelled
waiting → cancelled | failed
any non-terminal → failed  // budget
```

If a human wait is open **and** children still run: plan stays **running**, the human task is **waiting**.

### Task

```text
pending → running     // ready, slot available
running → pending     // not used; retries stay on same running child until fail
running → waiting     // human / approval
waiting → running     // userAnswer
running → completed | failed | cancelled
waiting → cancelled | failed
pending → cancelled   // plan cancelled
```

Retry: same task id, `attemptCount++`, status stays running inside the child until success or attempts exhausted.

## Validation rules

- Plan version task count ≤ 20
- Unique task ids per version
- DAG acyclic (Kahn / DFS)
- Dependency ids must exist
- `maxAttempts` 3, `maxReplans` 2
- Running agent tasks per plan ≤ 4
- Running agent tasks instance-wide ≤ 10
- `queuedFollowUp` null or one object
- Direct-action may not skip install/deploy/destructive/mode-switch waits

## Indexes

- `workflow_plans (session_id, status)`
- `workflow_plans (turn_id)` unique
- `workflow_tasks (status)` where status = `running` (instance cap)
- `workflow_tasks (plan_id, version)`
