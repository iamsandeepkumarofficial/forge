# Quickstart: Task I/O Contracts

## Showcase graph

```text
Research A ─┐
Research B ─┼──→ Synthesize ──→ Human Review ──→ Create Report
Research C ─┘
```

## Prerequisites

- Forge desktop or `pnpm dev` with Temporal + Postgres
- Agent mode, multi-step goal that triggers planning
- Feature code for `002-task-io-contracts` implemented

## Validate

1. **Plan publishes with contracts**  
   Ask for competitive research across three companies then a synthesis and human approval. Confirm every task has `inputSchema` / `outputSchema` (`schemaVersion: 1`) on the plan snapshot / DB row.

2. **Fan-in**  
   After Research A/B/C complete, Synthesize starts once. Inspect Synthesize `input` (or executor logs): keys for the three research tasks with materialized findings — not transcript scraping.

3. **Field mapping (if planner emitted mappings)**  
   Confirm Human Review input uses mapped fields (e.g. `summary` from Synthesize) rather than the whole prior bag when mappings say so.

4. **Human form**  
   Waiting Human Review shows fields from `outputSchema` on the plan card. Submit `{ approved: true, comment: "Looks good" }` → task completes. Retry with `{ approved: "banana" }` → does not complete.

5. **AC8 (no transcript bus)**  
   In tests (or a debug hook), clear/omit research prose from session messages after research completes; Synthesize must still receive structured inputs.

6. **Artifact spill**  
   Force a large research output (>64 KiB). Confirm `output.kind === "artifact"` and a file under `~/.forge/sessions/_artifacts/...`. Successor still receives contents.

## Expected outcome

A durable typed pipeline across agent / human / (optional tool) tasks without using chat history as the data bus.

See also: [contracts/temporal-io.md](./contracts/temporal-io.md), [contracts/http-answer.md](./contracts/http-answer.md), [RFC 0013](../../docs/rfcs/0013-task-io-contracts.md).
