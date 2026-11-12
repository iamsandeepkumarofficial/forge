import { generateText, Output, NoObjectGeneratedError } from "ai";
import { validatePlanDraft, type WorkflowPlanDraft } from "@forge/core";
import { resolveChatLanguageModel, coerceChatProvider } from "../chatModel.js";
import { resolveModelConfig } from "../model.js";
import { readForgeLlmConfig } from "../forgeLlmConfig.js";
import { withHeartbeats } from "./chatApi.js";
import { PLANNER_SYSTEM } from "./planPrompt.js";
import { planDraftSchema, type PlanDraftSchema } from "./planDraftSchema.js";

export const PLANNER_MAX_ATTEMPTS = 2;

export const DEFAULT_PLANNER_MAX_OUTPUT_TOKENS = 16_384;

export const DEFAULT_GATE_MAX_OUTPUT_TOKENS = 800;

export { coercePlannerTaskDraft, planDraftSchema } from "./planDraftSchema.js";
export type { PlanDraftSchema } from "./planDraftSchema.js";

function plannerInvocationError(message: string): Error {
  return new Error(`Planner invocation failed: ${message}`);
}

function formatZodIssues(cause: unknown): unknown[] | null {
  if (!cause || typeof cause !== "object") return null;
  const issues = (cause as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return null;
  return issues.map((issue) => {
    if (!issue || typeof issue !== "object") return issue;
    const i = issue as {
      path?: unknown;
      code?: unknown;
      message?: unknown;
      expected?: unknown;
      received?: unknown;
    };
    return {
      path: Array.isArray(i.path) ? i.path.join(".") : i.path,
      code: i.code,
      message: i.message,
      ...(i.expected !== undefined ? { expected: i.expected } : {}),
      ...(i.received !== undefined ? { received: i.received } : {})
    };
  });
}

function describeNoObjectCause(cause: unknown): {
  causeMessage: string | null;
  zodIssues: unknown[] | null;
  invalidValue: unknown;
} {
  if (cause == null) {
    return { causeMessage: null, zodIssues: null, invalidValue: null };
  }
  if (cause instanceof Error) {
    const withValue = cause as Error & { value?: unknown; cause?: unknown };
    const nestedIssues =
      formatZodIssues(withValue.cause) ?? formatZodIssues(cause);
    return {
      causeMessage: cause.message,
      zodIssues: nestedIssues,
      invalidValue: withValue.value ?? null
    };
  }
  return {
    causeMessage: String(cause),
    zodIssues: formatZodIssues(cause),
    invalidValue: null
  };
}

function errorMessage(err: unknown): string {
  if (NoObjectGeneratedError.isInstance(err)) {
    const described = describeNoObjectCause(err.cause);
    const zodSummary =
      described.zodIssues && described.zodIssues.length > 0
        ? `zodIssues=${JSON.stringify(described.zodIssues)}`
        : null;
    const parts = [
      err.message || "model did not produce a structured plan object",
      err.finishReason ? `finishReason=${err.finishReason}` : null,
      err.usage ? `usage=${JSON.stringify(err.usage)}` : null,
      err.text != null && String(err.text).length > 0
        ? `textLen=${String(err.text).length}`
        : "text=empty",
      err.response?.modelId ? `responseModelId=${err.response.modelId}` : null,
      zodSummary,
      described.causeMessage && !zodSummary
        ? `cause=${described.causeMessage}`
        : null
    ].filter(Boolean);
    return parts.join(" ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function logPlanner(event: string, fields: Record<string, unknown>): void {
  console.info(`[planner] ${event}`, fields);
}

function logStructuredPlannerFailure(opts: {
  detail?: string;
  requestedModel: string | null;
  resolvedModel: string;
  resolvedSource: string;
  err: unknown;
}): void {
  const { err } = opts;
  const base = {
    detail: opts.detail,
    requestedModel: opts.requestedModel,
    resolvedModel: opts.resolvedModel,
    resolvedSource: opts.resolvedSource,
    error: errorMessage(err)
  };
  if (!NoObjectGeneratedError.isInstance(err)) {
    logPlanner("generateText+output:fail", base);
    return;
  }
  const described = describeNoObjectCause(err.cause);
  logPlanner("generateText+output:fail", {
    ...base,
    finishReason: err.finishReason ?? null,
    causeMessage: described.causeMessage,
    zodIssues: described.zodIssues,
    invalidValue: described.invalidValue,
    rawText: err.text != null ? String(err.text) : null
  });
}

async function callPlannerStructured(opts: {
  system: string;
  prompt: string;
  provider: string;
  model?: string;
  maxOutputTokens?: number;
  detail?: string;
}): Promise<PlanDraftSchema> {
  const chatProvider = coerceChatProvider(opts.provider);
  const forge = await readForgeLlmConfig();
  const resolved = resolveModelConfig(
    { provider: chatProvider, name: opts.model },
    { baseUrl: forge.baseUrl, model: forge.model }
  );
  logPlanner("generateText+output:start", {
    detail: opts.detail,
    requestedProvider: opts.provider,
    requestedModel: opts.model ?? null,
    resolvedProvider: resolved.provider,
    resolvedModel: resolved.name,
    resolvedSource: resolved.source,
    resolvedBaseUrl: resolved.baseUrl ?? null,
    forgeConfigModel: forge.model ?? null,
    promptChars: opts.prompt.length
  });
  const model = await resolveChatLanguageModel(chatProvider, opts.model);
  try {
    const result = await withHeartbeats({
      work: generateText({
        model,
        output: Output.object({ schema: planDraftSchema }),
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens:
          opts.maxOutputTokens ?? DEFAULT_PLANNER_MAX_OUTPUT_TOKENS
      }),
      detail: {
        detail: opts.detail ?? "createPlan",
        requestedModel: opts.model ?? null,
        resolvedModel: resolved.name
      }
    });
    if (result.output == null) {
      throw new Error("model did not produce a structured plan object");
    }
    logPlanner("generateText+output:ok", {
      detail: opts.detail,
      resolvedModel: resolved.name,
      taskCount: result.output.tasks.length
    });
    return result.output;
  } catch (err) {
    logStructuredPlannerFailure({
      detail: opts.detail,
      requestedModel: opts.model ?? null,
      resolvedModel: resolved.name,
      resolvedSource: resolved.source,
      err
    });
    throw err;
  }
}

export async function callPlannerText(opts: {
  system: string;
  prompt: string;
  provider: string;
  model?: string;
  maxOutputTokens?: number;
  detail?: string;
}): Promise<string> {
  const chatProvider = coerceChatProvider(opts.provider);
  const model = await resolveChatLanguageModel(chatProvider, opts.model);
  const result = await withHeartbeats({
    work: generateText({
      model,
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_PLANNER_MAX_OUTPUT_TOKENS
    }),
    detail: opts.detail ?? "createPlan"
  });
  return result.text;
}

export async function invokePlannerWithRetries(opts: {
  provider: string;
  model?: string;
  detail: string;
  maxOutputTokens?: number;
  buildPrompt: (attempt: number, lastError: string | null) => string;
}): Promise<WorkflowPlanDraft> {
  let lastError: string | null = null;
  let lastResolved: string | null = null;
  const maxOutputTokens =
    opts.maxOutputTokens ?? DEFAULT_PLANNER_MAX_OUTPUT_TOKENS;
  for (let attempt = 1; attempt <= PLANNER_MAX_ATTEMPTS; attempt++) {
    try {
      const forge = await readForgeLlmConfig();
      const resolved = resolveModelConfig(
        {
          provider: coerceChatProvider(opts.provider),
          name: opts.model
        },
        { baseUrl: forge.baseUrl, model: forge.model }
      );
      lastResolved = resolved.name;
      const object = await callPlannerStructured({
        system: PLANNER_SYSTEM,
        prompt: opts.buildPrompt(attempt, lastError),
        provider: opts.provider,
        model: opts.model,
        maxOutputTokens,
        detail: opts.detail
      });
      const validated = validatePlanDraft(object);
      if (validated.ok) return validated.plan;
      lastError = validated.errors.map((e) => e.message).join("; ");
    } catch (err) {
      lastError = errorMessage(err);
    }
  }
  throw plannerInvocationError(
    `after ${PLANNER_MAX_ATTEMPTS} attempts` +
      ` (requestedModel=${opts.model ?? "undefined"}` +
      ` resolvedModel=${lastResolved ?? "unknown"}): ${lastError ?? "unknown"}`
  );
}
