import { isArtifactOutput, type ExecutionResult } from "@forge/core";
import type { PlanRunContext } from "./agentPlanTypes.js";

function valueFromTaskOutput(output: unknown): Record<string, unknown> | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const wire = output as { kind?: unknown; value?: unknown };
  if (wire.kind === "value" && wire.value && typeof wire.value === "object") {
    return wire.value as Record<string, unknown>;
  }
  if (wire.kind === "artifact") {
    return null;
  }
  return output as Record<string, unknown>;
}

function bodyFromOutputValue(value: Record<string, unknown>): string | null {
  const keys = Object.keys(value);
  const only = keys.length === 1 ? value[keys[0]!] : undefined;
  if (typeof only === "string" && only.trim()) {
    return only.trim();
  }
  try {
    const json = JSON.stringify(value, null, 2);
    return json && json !== "{}" ? json : null;
  } catch {
    return null;
  }
}

function summaryFromOutput(output: unknown): string | null {
  const value = valueFromTaskOutput(output);
  if (!value) return null;
  return bodyFromOutputValue(value);
}

function summaryText(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return bodyFromOutputValue(value as Record<string, unknown>);
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function transcriptNoteFromOutput(opts: {
  taskId: string;
  description: string;
  output: unknown;

  materialized?: unknown;
}): string | null {
  const title = opts.description.trim() || opts.taskId;
  const body =
    (opts.materialized !== undefined ? summaryText(opts.materialized) : null) ??
    summaryFromOutput(opts.output);
  if (body) return `### ${title}\n\n${body}`;
  if (isArtifactOutput(opts.output)) {
    return `### ${title}\n\nOutput stored as an artifact (${opts.output.metadata.bytes} bytes).`;
  }
  return null;
}

export function accumulateMetrics(opts: {
  ctx: PlanRunContext;
  result: ExecutionResult;
  materialized?: unknown;
}): void {
  const { ctx, result, materialized } = opts;
  if (result.kind === "completed") {
    if (result.metrics) {
      if (typeof result.metrics.rounds === "number") {
        ctx.rounds += result.metrics.rounds;
      }
      if (typeof result.metrics.toolCallCount === "number") {
        ctx.toolCallCount += result.metrics.toolCallCount;
      }
    }
    const summary =
      (materialized !== undefined ? summaryText(materialized) : null) ??
      summaryFromOutput(result.output);
    if (summary) {
      ctx.finalText = summary;
    }
    return;
  }
  if (result.kind !== "waiting") {
    return;
  }
  const bag = result.waitReason.payload;
  if (!bag || typeof bag !== "object") {
    return;
  }
  const m = bag as {
    rounds?: unknown;
    toolCallCount?: unknown;
    finalText?: unknown;
  };
  if (typeof m.rounds === "number") {
    ctx.rounds += m.rounds;
  }
  if (typeof m.toolCallCount === "number") {
    ctx.toolCallCount += m.toolCallCount;
  }
  if (typeof m.finalText === "string" && m.finalText) {
    ctx.finalText = m.finalText;
  }
}
