# Contract: Human task answer API

Amends the Step 1 answer endpoint used for plan waits.

## POST `/api/sessions/:sessionId/turns/:turnId/answer`

### Body (Step 2)

```ts
{
  taskId?: string;
  // Prefer structured payload for human tasks:
  payload?: unknown;
  // Legacy / ask_user text still accepted for non-schema waits:
  text?: string;
  decision?: "approve" | "reject" | "skip";
}
```

Rules:

- For human tasks with `outputSchema`, client SHOULD send `payload` matching the schema.
- Server MAY return 400 for obviously malformed bodies.
- Temporal signal still delivers the payload to the parent workflow.
- Engine `validateTaskOutput` after `HumanExecutor.resume` is authoritative; HTTP 400 is not sufficient for contract safety.
- Reject/skip → task failed (unchanged).

### Signal shape

```ts
userAnswer: {
  taskId?: string;
  text?: string;
  payload?: unknown;
  decision?: "approve" | "reject" | "skip";
}
```

`maybeApplyAnswer` passes `payload` through without type rewriting.

## Plan snapshot (UI)

`WorkflowPlanSnapshot.tasks[]` includes `inputSchema` / `outputSchema` / `status` / `waitReason` (without schema dump in waitReason). Plan card generates the form from `task.outputSchema` when `status === "waiting"` and `executor === "human"`.
