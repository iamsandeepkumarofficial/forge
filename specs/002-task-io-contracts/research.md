# Research: Task I/O Contracts

## Decision: JSON Schema on the DAG, Zod in app code

**Decision:** Persist a constrained JSON Schema subset on each task. Use Zod for the planner envelope and tool-result decode only.

**Rationale:** Planner LLM emits JSON; Temporal replay and Postgres JSONB require serializable data; agent/tool/human need one runtime representation. Zod objects (closures, refine, transform) cannot live in workflow history.

**Alternatives considered:**

- Store Zod and rehydrate — fails Temporal determinism and Postgres round-trip.
- Free-form `unknown` only — reverts to Step 1; no contracts.
- Full JSON Schema + Ajv in the workflow sandbox — locale/format plugins risk non-determinism; subset + pure checker is enough for Step 2.

## Decision: Agent owns completion in-loop

**Decision:** Each planned-agent `runLlmStep` uses AI SDK `streamText`/`generateText` with tools **and** `output: Output.object({ schema: jsonSchema(outputSchema) })`. Terminal schema object completes the task. No post-loop `generateObject`.

**Rationale:** User requirement: no separate “interpret what the agent said” call. AI SDK documents combining tool calling with structured output. Forge keeps its custom one-step-per-round ReAct loop.

**Alternatives considered:**

- ReAct then `generateObject` — rejected as transcript interpreter.
- Replace ReAct with one SDK-managed multi-step `generateText` — larger rewrite; out of scope.
- `complete_task` tool only — kept as fallback when a provider cannot combine tools + structured output.

## Decision: Three schemas stay separate

**Decision:** Tool input schema (LLM args), tool native result (execute return), and task `outputSchema` (workflow contract) are distinct. ToolExecutor normalizes native results; engine validates the task contract. No transform language in Step 2.

**Rationale:** Collapsing them would make tool catalog changes break workflows and confuse LLM-generated args with durable task I/O.

## Decision: Artifacts as refs; successors get contents

**Decision:** Persist `{ kind: "artifact", artifactId }` when over 64 KiB. `prepareTaskInput` always materializes before validate/execute. Bytes live under `~/.forge/sessions/_artifacts/...`, not the git worktree.

**Rationale:** Avoid Temporal/Postgres/SSE bloat; keep executors ignorant of the store; align with existing session sidecar layout (`_checkpoints`, `_host`).

**Alternatives considered:** Always inline JSONB — unsafe for large research. S3 now — premature; swap backend later behind `artifactId`.

## Decision: Schema budget + schemaVersion + closed objects

**Decision:** Hard caps (8 KiB, depth 4, 32 properties, 16 enums, 256 description chars); root `schemaVersion: 1`; omitted `additionalProperties` → `false`.

**Rationale:** Planner can emit huge or open schemas that land in Temporal, Postgres, SSE, and prompts. Closed-by-default prevents silent extras from satisfying contracts. Version field lets future subset bumps refuse unknown formats on durable workflows.

## Decision: waitReason does not carry schemas

**Decision:** UI reads `task.outputSchema` from plan snapshot / task id. `waitReason.payload` stays wait-kind metadata only.

**Rationale:** Schemas are already first-class on the task; duplicating into Temporal wait state and SSE is wasted weight.

## Decision: Human UI is not the authority

**Decision:** Form validation is UX. Engine `validateTaskOutput` gates completion.

**Rationale:** Malicious or buggy clients can POST anything; HTTP 400 is optional niceness, not the contract.
