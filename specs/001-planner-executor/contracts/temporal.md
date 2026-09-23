# Temporal contracts

Task queue: existing `forge-orchestrator`.

## Workflows

### `interactiveAgentWorkflow` (parent)

Args: same as today’s `InteractiveChatTurnArgs` plus optional `forceFromQueue`.

Workflow id: `agent-{sessionId}-{turnId}`.

Responsibilities: `createPlan` → persist → loop ready set → start children (caps 4 / 10) → merge worktrees → replan / budget / wait → terminal `finalizeChatTurn`.

Ask mode does **not** use this workflow.

### `executeAgentTaskWorkflow` (child)

Args: `{ sessionId, turnId, planId, taskId, version, attempt, worktreePath? }`.

Workflow id: `agent-{sessionId}-{turnId}-task-{taskId}-a{attempt}`.

Runs the extracted ReAct loop against the session (or nested worktree). On `ask_user` / `switch_mode` needing confirmation: complete activity with `needsUserInput`, parent sets task `waiting` and does **not** close the child until signal — child uses `condition` + signal `resumeTask` or parent cancels and respawns after answer (prefer: child waits on signal so tool round state stays in that workflow).

### `interactiveChatTurnWorkflow`

Unchanged for Ask mode.

## Signals (parent)

| Signal          | Payload               | Effect                                             |
| --------------- | --------------------- | -------------------------------------------------- |
| `queueFollowUp` | chat body             | Replace single-slot queue                          |
| `forceSend`     | chat body             | Cancel self + children, caller starts new workflow |
| `userAnswer`    | `{ taskId, payload }` | Resume waiting task; not a new request             |
| `cancelRun`     | none                  | Cancel children + pending tasks                    |

## Signals (child)

| Signal       | Payload       | Effect                    |
| ------------ | ------------- | ------------------------- |
| `resumeTask` | `{ payload }` | Continue after human wait |

## Queries

| Query       | Returns                             |
| ----------- | ----------------------------------- |
| `getPlan`   | Current plan snapshot               |
| `getBudget` | `{ workingMs, llmTokens, costUsd }` |

## Activities (additions)

- `createPlan` / `repairPlan` / `replan`
- `persistPlan` / `persistTask`
- `countRunningAgentTasks` (instance cap)
- `acquireTaskSlot` / `releaseTaskSlot`
- `ensureTaskWorktree` / `mergeTaskWorktree` (abort on conflict; persist artifacts)
- `spawnConflictResolver` (child agent, max 2 attempts, then `userAnswer` wait)
- `executeDirectTool` — named tool via existing chat tool registry (ToolExecutor only; never AgentExecutor)
- `recordLlmUsage`
- Existing: `runLlmStep`, `executeChatTool`, `ensureChatSandbox`, message helpers

## Executor registry (RFC 0012)

Parent ready-set loop dispatches through a fixed `ExecutorRegistry` for the run:

| Kind    | Class           | Mechanism                                       |
| ------- | --------------- | ----------------------------------------------- |
| `agent` | `AgentExecutor` | `startChild("executeAgentTaskWorkflow")` only   |
| `human` | `HumanExecutor` | `execute` → waiting; optional `resume(payload)` |
| `tool`  | `ToolExecutor`  | `executeDirectTool` activity; optional `resume` |

Executors return `ExecutionResult` (`waiting` \| `completed` \| `failed`). The engine maps results to task rows + SSE. No aliases; unknown kind → task failed. Agent-internal `ask_user` still completes the child and respawns after answer (child `resumeTask` not required in this step).

## Cancellation

`cancelInteractiveChatTurn` must cancel the parent id (`agent-…`). Parent `CancellationScope.nonCancellable` only for persist-final-status. Children listed in plan rows are cancelled in a `finally`.
