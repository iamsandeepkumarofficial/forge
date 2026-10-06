# RFC 0011: Planner / Executor orchestration

**Status**: Accepted for implementation (feature `001-planner-executor`)  
**Date**: 2026-09-22

## Summary

Forge runs Agent/Auto/Multitask/Debug/Plan turns through a Temporal parent workflow (`interactiveAgentWorkflow`). Ask mode keeps `interactiveChatTurnWorkflow`.

Before Planner→DAG→Executor, Agent/Auto/Multitask/Debug runs a cheap **LLM planning gate** that returns only `{ needsPlanning, reason }`. When `needsPlanning` is false (greetings, single-step chat), the parent uses the existing ReAct loop with **no** plan artifact or Plan UI. Plan mode always plans. Gate LLM failure biases to direct ReAct (under-plan).

## Key behavior

- Cap 20 tasks/version, 4 agents/run, 10/instance
- Nested worktrees + completion-order merge; conflict resolver ≤2 attempts then human wait
- Idempotent retries ≤3; replan ≤2; budget 30m working / 500k tokens / $3
- Queue one follow-up (replace); `forceSend` cancels and starts new
- Human wait keeps the parent alive; idle time does not burn the 30m cap
- Planning gate classifies on capabilities (multi-step, deps, parallel, durable wait, approval, retry/replan benefit) — not keyword lists; does not create tasks or execute tools
- Planner uses AI SDK `generateObject` + Zod (≤20 tasks); malformed output is a bounded planner invocation failure, not a workflow replan

## Specs

See `specs/001-planner-executor/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`).

## Follow-on

Executor dispatch (agent / human / tool behind a registry, `ExecutionResult`, no engine `if/else` on kind) is specified in [RFC 0012](./0012-executor-abstraction.md).
