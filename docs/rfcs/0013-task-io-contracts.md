# RFC 0013: Task I/O contracts

**Status**: Accepted  
**Date**: 2026-11-10  
**Amends**: [0011](./0011-planner-executor.md), [0012](./0012-executor-abstraction.md)

## Summary

Make every plan task carry a mandatory, serializable **input/output contract**. The workflow engine resolves dependency outputs into successor input, validates both sides against JSON Schema, and only then calls an executor. Executors remain DAG-ignorant: they receive materialized `context.input` and return schema-valid structured output.

This fills the explicit gap left by RFC 0012: **“Step 1 has no task I/O.”** The chat transcript is no longer the workflow data bus.

## Invariant

> The workflow engine owns task contracts and data movement. Executors own execution. LLMs are one mechanism for producing structured task results, not the workflow’s data model.

## Architecture

```text
Planner (generateText + Output.object + Zod envelope)
        │
        ▼
DAG with inputSchema / outputSchema (JSON Schema docs)
        │
        ▼
Engine
  prepareTaskInput → validateTaskInput → executor.execute(context.input)
        │
        ▼
Executor returns TaskOutput
        │
        ▼
validateTaskOutput → spill if large → persist wire form → ready successors
```

## Contracts on the task

Every task MUST have:

- `inputSchema` — JSON Schema subset document
- `outputSchema` — JSON Schema subset document
- `inputMappings?` — optional `{ fromTask, outputPath?, targetPath? }[]`

Schemas are **not** Zod objects on the DAG. Zod is used in application code (planner envelope, tool result decode). Persisted/Temporal state stores JSON Schema only.

Root schema documents MUST include `schemaVersion: 1`. Omitted `additionalProperties` on objects is treated and normalized as `false`.

### Schema budget (per root schema)

| Limit                          | Value |
| ------------------------------ | ----- |
| Bytes (`JSON.stringify` UTF-8) | 8192  |
| Nesting depth                  | 4     |
| Total `properties` keys        | 32    |
| Enum values per `enum`         | 16    |
| Description chars              | 256   |

Over-budget or unknown keywords fail at the **planner boundary** (`validatePlanDraft`), not at execute time.

## Input resolution

Default (no mappings): successor input is `{ [depId]: materializedDepOutput, ... }`.

With mappings: start from `{}` and apply each mapping. Path language is tiny JSONPath (`$.a.b` only) — no `map`/`filter`/`if`.

Root tasks: planner static `input` if present, else `{}`.

## TaskOutput wire form vs executor input

```ts
type TaskOutput =
  | { kind: "value"; value: unknown }
  | { kind: "artifact"; artifactId: string; metadata: ArtifactMetadata };
```

- **Persisted** on `workflow_tasks.output`: wire `TaskOutput` (value or artifact ref).
- **Passed to executors**: materialized JSON matching `inputSchema`. Never `{ kind, artifactId }`.

Large values (>64 KiB serialized) spill to:

```text
~/.forge/sessions/_artifacts/{sessionId}/{planId}/{taskId}/{artifactId}.json
```

Outside the git worktree (same metadata family as `_checkpoints` / `_host`).

## Executors

`TaskExecutionContext` gains `input: unknown` (already resolved and validated).

`ExecutionResult.completed` carries `{ output: TaskOutput; metrics?: { rounds?; toolCallCount? } }`. Metrics are not smuggled inside the contract object.

### Agent

Keep the custom ReAct loop. Each planned-agent LLM step uses AI SDK `streamText`/`generateText` with **tools and** `output: Output.object({ schema: jsonSchema(outputSchema) })` on the **same** call. The terminal step that emits a schema object **is** the task output. No post-loop `generateObject` over the transcript.

Fallback if a provider cannot combine tools + structured output: in-loop synthetic `complete_task` tool whose args are `outputSchema`.

### Tool

Tool native results are defined by the tool `execute()`, not the LLM. `ToolExecutor` normalizes raw results (object / JSON string / plain string) then the engine validates against `task.outputSchema`. No transform language in this RFC; the planner should align `outputSchema` with the native tool result.

### Human

Workbench form is generated from `task.outputSchema` on the plan snapshot (not copied into `waitReason.payload`). Client validation is UX only. Engine `validateTaskOutput` is the authority: invalid payloads (e.g. `{ approved: "banana" }` when boolean required) must not complete the task.

## Three schemas (do not collapse)

| Schema                   | Producer          | Consumer             |
| ------------------------ | ----------------- | -------------------- |
| Tool input (catalog Zod) | LLM args          | Tool                 |
| Tool native result       | Tool `execute()`  | ReAct / ToolExecutor |
| Task `outputSchema`      | Executor → engine | Next task            |

## Acceptance criteria

1. Every task has `inputSchema` + `outputSchema` (`schemaVersion: 1`, within budget).
2. Invalid output → `failed`; never `completed` with prose / `undefined`.
3. Dependency outputs become successor input without using chat history as the data bus.
4. Fan-in works (`{ a, b, c }` from three deps).
5. Field mapping `outputPath` → `targetPath` works.
6. Large output → artifact ref; successor receives materialized contents.
7. Executors receive `context.input` only (no DAG / Postgres queries).
8. A→B succeeds even when the transcript lacks A’s findings.

## Out of scope

- Expression language (`map` / `filter` / `if` / `foreach`)
- Silent LLM compaction between tasks
- Cross-workflow task references (parent←child is later)
- S3 / object storage (filesystem artifact store only)
- Schema registry / shared named types
- ReAct rewrite; specialist agent personas
- Post-loop “interpret the agent transcript” LLM call
- Deep structural schema assignability at plan time

## Specs

See `specs/002-task-io-contracts/`.
