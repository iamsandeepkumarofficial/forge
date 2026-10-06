# Implementation Plan: Planner / Executor Orchestration

**Branch**: `001-planner-executor` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-planner-executor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a durable **planner/executor** layer above Forge’s one-action ReAct chat turn. A Temporal **parent** workflow publishes a first-class DAG (≤20 tasks), runs ready **agent** tasks as child ReAct workflows (max 4 per run, 10 per instance), merges nested **worktrees** for same-repo parallel edits, retries idempotent task failures (3 attempts), replans (2 DAG versions), pauses for human approval **without ending the workflow**, and queues or force-sends follow-ups. The workbench shows a structured plan card on the existing transcript (no new route). Ask mode keeps today’s `interactiveChatTurnWorkflow`.

Build in spec order: P1 sequential plan+execute+UI → P2 DAG/parallel/worktrees/retries → P3 replan+budgets → P4 signals/HITL/queue → P5 tool/human executor kinds.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+, pnpm workspace

**Primary Dependencies**: Temporal (`@temporalio/workflow` 1.11), AI SDK `ai` 6.x, Drizzle ORM 0.38, Express, React 19 / Vite 8 (web-ui), Zod 4, existing `@forge/core`, `@forge/db`, `@forge/orchestrator`, `@forge/server`

**Storage**: PostgreSQL 16 (`workflow_plans`, `workflow_tasks` + existing `chat_turns` / `chat_turn_chunks`); git worktrees on the host session tree (RFC 0005)

**Testing**: Node `tsx --test` (server, orchestrator, db, core); Vitest (web-ui); Temporal workflow unit tests with existing helper style

**Target Platform**: Forge desktop (Electron + native Postgres/Temporal) and optional `pnpm dev` compose; single-user local harness

**Project Type**: Desktop coding-agent harness (chat UI + tool-plane + Temporal worker)

**Performance Goals**: Plan card visible before first source mutation (same visit); plan statuses understandable in <10s from the card (SC-002); independent inspect tasks may overlap; 30 minutes **working** time cap

**Constraints**: max 4 in-session agents per run, 10 per instance; maxAttempts 3; maxReplans 2; 30m / 500k tokens / $3.00; one active run per chat; one queued follow-up; no named specialist-agent circus; constitution file is still an unratified template

**Scale/Scope**: Single-user desktop; one plan per turn; ≤20 tasks per version; reuse current sandbox/tools/preview

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is a **placeholder** (unratified). Gates used instead — existing Forge product boundaries from RFC 0001 and the spec:

| Gate                                                 | Status | Notes                                                              |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Stay a chat-only harness (no board/pipeline product) | Pass   | Plan lives in the chat workbench                                   |
| Durable execution via existing Temporal worker       | Pass   | Parent+child on `forge-orchestrator`; no new infra product         |
| Tools run in the session sandbox                     | Pass   | Children use the same session; nested worktrees only for isolation |
| Schema via Drizzle + numbered migrations             | Pass   | `0021` plans/tasks                                                 |
| Tests before / with behavior (node:test / vitest)    | Pass   | Scheduler, DAG, budget, API, UI card                               |
| Do not replace ReAct tools                           | Pass   | Inner loop extracted, not rewritten                                |

**Post-design re-check:** Still pass. Complexity is one extra workflow type + two tables + SSE/UI, justified in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-planner-executor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-plan.md
│   ├── sse-events.md
│   └── temporal.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/core/src/workflow/          # Plan/task types, DAG validate, budget helpers, price table
packages/db/src/schema.ts            # workflowPlans, workflowTasks
packages/db/migrations/0021_*.sql
packages/orchestrator/src/workflows/
├── interactiveChatTurnWorkflow.ts   # Ask mode; extract shared ReAct helper
├── interactiveAgentWorkflow.ts      # Parent coordinator (NEW)
├── executeAgentTaskWorkflow.ts      # Child in-session agent (NEW)
└── planScheduler.ts                 # Ready set, caps, cycle check (unit-tested)
packages/orchestrator/src/activities/
├── plan.ts                          # createPlan, replan, persist, usage, slots
└── worktree.ts                      # ensure/merge nested task worktrees
apps/server/src/orchestration/chatTemporalClient.ts  # start parent, signals
apps/server/src/api/chatRouter/      # queue/forceSend, answer, GET plan
apps/server/src/projects/localWorktree.ts  # nested worktree helpers
apps/web-ui/src/routes/chat-workbench/
├── plan-card.tsx                    # Structured plan view
└── use-plan-stream.ts               # SSE plan events + queue banner
```

**Structure Decision:** Extend the existing monorepo packages. No new app or package. Core holds pure DAG/budget types so orchestrator workflows can import them without Node libs where possible (validate in a workflow-safe module with no I/O).

## Complexity Tracking

| Violation                              | Why Needed                                                     | Simpler Alternative Rejected Because                                      |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Parent + child Temporal workflows      | Parallel in-session agents need independent cancel/retry/HITL  | Sequential-only executor fails SC-004 and user parallel-agent requirement |
| Two new tables vs JSON on `chat_turns` | Instance cap of 10 requires counting running tasks across runs | JSON blob cannot cheaply enforce FR-025                                   |
| Nested git worktrees                   | Same-session parallel mutations without file races             | Shared tree races; extra full clones are heavier than RFC 0005 worktrees  |

## Implementation notes (for `/speckit-tasks`)

1. **P1** — Types + `createPlan` + persist + sequential child (cap 1) + plan card + Ask unchanged.
2. **P2** — Ready-set parallel (4/10), worktree isolate/merge, conflict resolver sub-agent (2 attempts) then human wait, idempotent retries.
3. **P3** — Replan versions, working-time/token/cost stop.
4. **P4** — Signals: wait without killing the parent; queue vs forceSend (replace 409); idle clock pause.
5. **P5** — `tool` / `human` executor kinds (approvals never skipped).
