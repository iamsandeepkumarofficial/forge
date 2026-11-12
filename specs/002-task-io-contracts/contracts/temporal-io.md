# Contract: Temporal activities for task I/O

## prepareTaskInput

**Activity** (Node, may touch filesystem / DB)

```ts
input: {
  sessionId: string;
  planId: string;
  version: number;
  taskId: string;
  inputSchema: TaskSchema;
  inputMappings: InputMapping[];
  dependencies: Array<{ id: string; output: TaskOutput | null }>;
  staticInput?: unknown; // root / tool planner input
}
output: {
  ok: true;
  input: unknown; // materialized
} | {
  ok: false;
  error: string;
}
```

Rules:

- Unwrap `{ kind: "value" }` and load `{ kind: "artifact" }` for every dependency used.
- Apply default fan-in or mappings.
- Do **not** validate against `inputSchema` here if the workflow prefers pure validate in-core; either way, executor must not see wire form.
- Failure loading an artifact → `ok: false`.

## spillTaskOutput

```ts
input: {
  sessionId: string;
  planId: string;
  taskId: string;
  value: unknown;
}
output: TaskOutput; // value or artifact
```

If `JSON.stringify(value)` byte length ≤ 65536 → `{ kind: "value", value }`, else write file and return `{ kind: "artifact", artifactId, metadata }`.

## loadTaskArtifact

```ts
input: { sessionId: string; planId: string; taskId: string; artifactId: string }
output: { ok: true; value: unknown } | { ok: false; error: string }
```

## Workflow-safe core (no I/O)

Called inside Temporal workflow sandbox:

- `validateTaskSchema`
- `validateTaskInput`
- `validateTaskOutput`
- path mapping pure helpers (after activity materializes values)

## ExecutionResult (amends RFC 0012)

```ts
| { kind: "completed"; output: TaskOutput; metrics?: { rounds?: number; toolCallCount?: number } }
| { kind: "waiting"; waitReason: TaskWaitReason }
| { kind: "failed"; error: string }
```

`TaskExecutionContext` includes `input: unknown`.
