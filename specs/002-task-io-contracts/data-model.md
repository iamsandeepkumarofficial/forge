# Data model: Task I/O Contracts

Extends [`specs/001-planner-executor/data-model.md`](../001-planner-executor/data-model.md).

## Entities

### TaskSchema (document)

Root JSON object persisted on each task:

| Field                | Rules                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| schemaVersion        | Required integer; only `1` accepted in this feature                             |
| type                 | `object` \| `array` \| `string` \| `number` \| `integer` \| `boolean` \| `null` |
| properties           | map of nested fragments (no schemaVersion on nested nodes)                      |
| required             | string[]                                                                        |
| items                | nested fragment                                                                 |
| description          | string ≤ 256 chars                                                              |
| enum                 | ≤ 16 values                                                                     |
| additionalProperties | boolean only; omitted → normalize to `false`                                    |

**Budget per root schema:** ≤ 8192 UTF-8 bytes; depth ≤ 4; ≤ 32 property keys total in the tree.

**Rejected keywords:** `$ref`, `allOf`, `anyOf`, `oneOf`, `format`, unknown keys.

### InputMapping

```ts
{ fromTask: string; outputPath?: string; targetPath?: string }
```

- `fromTask` MUST be a declared dependency.
- Paths: `$.a.b` only (dot segments after `$`).

### TaskOutput (wire form)

```ts
| { kind: "value"; value: unknown }
| { kind: "artifact"; artifactId: string; metadata: { bytes: number; contentType: string } }
```

Stored in `workflow_tasks.output`. Temporal `TaskState.output` holds the same wire form.

### ResolvedInput

Plain JSON matching `inputSchema`. Built by `prepareTaskInput`. Passed as `TaskExecutionContext.input`. Never the wire `TaskOutput` wrapper.

### Artifact

| Path                                                                           | Role          |
| ------------------------------------------------------------------------------ | ------------- |
| `~/.forge/sessions/_artifacts/{sessionId}/{planId}/{taskId}/{artifactId}.json` | Spilled bytes |

Not under `{projectId}/{sessionId}` worktree. Sidecar family with `_checkpoints` and `_host`.

Inline spill threshold: `MAX_INLINE_TASK_OUTPUT_BYTES` = 65536.

## WorkflowTask columns (delta)

| Column         | Type                        | Notes                                                           |
| -------------- | --------------------------- | --------------------------------------------------------------- |
| input_schema   | jsonb not null              | TaskSchema                                                      |
| output_schema  | jsonb not null              | TaskSchema                                                      |
| input_mappings | jsonb not null default `[]` | InputMapping[]                                                  |
| input          | jsonb                       | May store refs for durability; executor still gets materialized |
| output         | jsonb                       | Wire TaskOutput                                                 |

Migration: `0022_task_io_contracts.sql`.

## WorkflowTaskDraft / Snapshot (delta)

```ts
inputSchema: TaskSchema;
outputSchema: TaskSchema;
inputMappings?: InputMapping[];
```

`toSnapshot` MUST include schemas on each task (UI form source). MUST NOT put schemas in `waitReason.payload`.

## TaskExecutionContext (delta)

```ts
{
  workflowId, sessionId, turnId, planId, taskId,
  input: unknown // materialized + validated
}
```

## ExecutionResult (delta)

```ts
| { kind: "completed"; output: TaskOutput; metrics?: { rounds?: number; toolCallCount?: number } }
| { kind: "waiting"; waitReason: TaskWaitReason }
| { kind: "failed"; error: string }
```

## State transitions (I/O related)

```text
pending → (ready) → prepareTaskInput
  → input invalid → failed
  → input valid → running → executor
      → completed + output valid → persist wire → completed
      → completed + output invalid → failed
      → waiting (human/approval) → resume → same output validation
```

## Relationships

```text
WorkflowTask 1 ─── 1 inputSchema document
WorkflowTask 1 ─── 1 outputSchema document
WorkflowTask 0..* InputMapping
WorkflowTask.output ──?── Artifact (when kind=artifact)
```
