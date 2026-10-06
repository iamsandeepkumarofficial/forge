# RFC 0012: Executor abstraction

**Status**: Accepted  
**Date**: 2026-09-23  
**Amends**: [0011](./0011-planner-executor.md)

## Summary

Separate Forge's workflow **engine** (DAG, ready-set, persistence, HITL park) from **how** a plan task runs. Ready tasks are dispatched through an `ExecutorRegistry` of Temporal-safe classes: `AgentExecutor`, `HumanExecutor`, `ToolExecutor`. Executors return an `ExecutionResult`; only the engine persists task state and SSE.

Invariant: **the engine knows that a task needs execution; it does not need to know how that task is executed.**

## Architecture

```text
Workflow engine
      │ ready task
      ▼
ExecutorRegistry
  ├── agent → AgentExecutor → startChild(executeAgentTaskWorkflow)
  ├── human → HumanExecutor → waiting | completed | failed
  └── tool  → ToolExecutor  → executeDirectTool activity
                                    │
                                    ▼
                          existing chat tool registry
```

No aliases. Unknown executor kinds fail the task visibly. Registry is fixed for one planned workflow run.

## ExecutionResult (not task state)

```ts
type ExecutionResult =
  | { kind: "waiting"; waitReason: TaskWaitReason }
  | { kind: "completed"; output?: unknown }
  | { kind: "failed"; error: string };
```

`in_flight` is **not** an executor result. Parallelism stays on the engine's `ctx.inFlight` map of pending `execute()` promises.

## TaskExecutor interface

```ts
interface TaskExecutor {
  execute(task, context: TaskExecutionContext): Promise<ExecutionResult>;
}

interface ResumableExecutor extends TaskExecutor {
  resume(task, payload: unknown, context): Promise<ExecutionResult>;
}
```

`resume` is optional. Human and Tool implement it. Agent does not.

`TaskExecutionContext` is slim: `{ workflowId, sessionId, turnId, planId, taskId }`. Not `PlanRunContext`. No DB clients.

## Executors

| Kind    | Class           | Behavior                                                                                                                                                                    |
| ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent` | `AgentExecutor` | `startChild("executeAgentTaskWorkflow")` only. No ReAct move. Must not call `executeDirectTool` or import `ToolExecutor`.                                                   |
| `human` | `HumanExecutor` | `execute` → waiting. `resume(payload)` → completed on approve, failed on reject/skip. Run cancel never calls resume.                                                        |
| `tool`  | `ToolExecutor`  | Resolve `toolName` from `task.input`. Activity over existing tool catalog. Missing/unknown → failed. Approval-required → waiting then resume. Never starts the agent child. |

Constructors may take proxied activity stubs / Temporal APIs they need. They must not persist DB/SSE themselves.

## Human resume

Engine parks on `userAnswer` / `cancelRequested`. Approve → `resume` → completed. Reject/skip → `resume` → failed (dependents stay blocked; Step 1 has no task I/O). Cancel → engine marks cancelled; `resume` not called.

Agent-internal `ask_user` is unchanged: child returns waiting; answer → pending → new child.

## Out of scope

Task I/O graph, retry redesign, replan changes, worktree isolation redesign, conflict resolution, agent `resumeTask`, webhooks, schedules, additional executor kinds.

## Specs

See `specs/001-planner-executor/contracts/temporal.md` (executor registry addendum).
