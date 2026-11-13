# Implementation Plan: Task I/O Contracts

**Branch**: `002-task-io-contracts` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-task-io-contracts/spec.md`

## Summary

Add mandatory per-task input/output JSON Schema contracts, engine-owned input resolution and validation, artifact spill for large outputs, planner emission of schemas, and structured completion for agent/tool/human executors. The transcript stops being the workflow data bus.

Build order: core schema module + DAG validation → DB migration → engine prepare/validate path + artifacts → planner → agent structured terminal step → tool normalize + human form → fan-in/mapping/AC8 tests.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+, pnpm workspace

**Primary Dependencies**: Temporal, AI SDK `ai` 6.x (`Output.object`, `jsonSchema`), Drizzle, Zod 4 (planner envelope + tool decode only), existing `@forge/core`, `@forge/db`, `@forge/orchestrator`, `@forge/server`, web-ui

**Storage**: PostgreSQL (`workflow_tasks` columns for schemas/mappings; `output` stores wire `TaskOutput`); artifacts under `~/.forge/sessions/_artifacts/...`

**Testing**: Node `tsx --test` (core, orchestrator, server); Vitest (web-ui)

**Target Platform**: Forge desktop / local harness

**Constraints**: Schema budgets (8 KiB / depth 4 / 32 properties / 16 enums / 256 description chars); inline output spill at 64 KiB; no expression language; no post-loop agent interpreter

## Constitution Check

`.specify/memory/constitution.md` remains unratified. Gates from RFC 0001 / 0011 / 0012 / 0013:

| Gate                          | Status | Notes                                         |
| ----------------------------- | ------ | --------------------------------------------- |
| Chat-only harness             | Pass   | Plan card + answer API only                   |
| Durable Temporal execution    | Pass   | Activities for prepare/spill/load             |
| Tools in session sandbox      | Pass   | Unchanged tool catalog                        |
| Drizzle + numbered migrations | Pass   | `0022_task_io_contracts.sql`                  |
| Tests with behavior           | Pass   | Core validators + orchestrator I/O + UI form  |
| Do not replace ReAct          | Pass   | Same loop; add structured output on each step |

## Project Structure

### Documentation

```text
specs/002-task-io-contracts/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── temporal-io.md
│   └── http-answer.md
├── checklists/requirements.md
└── tasks.md
docs/rfcs/0013-task-io-contracts.md
```

### Source Code

```text
packages/core/src/workflow/
├── types.ts                 # schemas, TaskOutput, context.input
├── dag.ts                   # validatePlanDraft + schema checks
└── schemas/                 # NEW: validate/resolve pure modules
packages/db/migrations/0022_task_io_contracts.sql
packages/db/src/schemaWorkflow.ts
packages/orchestrator/src/
├── activities/plan.ts / planInvoke.ts / artifacts.ts
└── workflows/
    ├── agentPlanLaunch.ts / agentPlanLoop.ts
    ├── agentChildArgs.ts / executeAgentTaskWorkflow.ts / reactLoop.ts
    └── executors/{agent,tool,human}.ts
apps/server/.../workflowPlanRepository.ts, workflow.handlers.ts, handlers.ts
apps/web-ui/.../plan-card.tsx, chat-agent.ts, schema form helpers
```

## Complexity Tracking

| Violation                                             | Why Needed                                   | Simpler Alternative Rejected                |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| Artifact store vs always-JSONB                        | Temporal/Postgres/SSE size                   | Always-inline breaks large research outputs |
| In-loop structured output vs post-loop generateObject | Agent owns completion; no interpreter call   | Post-loop summarizer violates FR-008        |
| Pure JSON Schema subset validator                     | Temporal-deterministic, no Ajv locale issues | Full Ajv in workflow sandbox                |

## Implementation notes

1. Phase 0 docs (this folder + RFC 0013) are the gate.
2. Core schemas first — everything else depends on `validateTaskSchema` / `resolveTaskInput`.
3. Engine path before agent UI — prove A→B with stub executors.
4. Agent structured step last among executors after `context.input` injection works.
