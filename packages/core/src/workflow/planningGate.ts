export type PlanningGateResult = {
  needsPlanning: boolean;
  reason: string;
};

const GATE_REASON_MAX = 200;

export const PLANNING_GATE_SYSTEM = `You are a planning gate for Forge, a coding agent.
Decide whether the user request needs an explicit multi-step plan (Planner → task DAG → Executor)
or can be handled by a single ReAct chat turn.

Answer ONLY these capability questions (not keyword matching):
- Does the request require multiple meaningful steps?
- Are there dependencies between those steps?
- Could independent work execute concurrently?
- Does it require durable execution or waiting across turns?
- Does it require human approval?
- Would explicit task state / retry / replanning materially help?
- Can the existing ReAct turn reasonably complete it as one execution?

Return ONLY a JSON object:
{"needsPlanning":true|false,"reason":"short_snake_or_brief_phrase"}

Rules:
- Prefer needsPlanning:false (under-plan) for greetings, acks, single questions, and simple one-shot actions a ReAct turn can finish.
- Prefer needsPlanning:true when multi-step implementation, coordination, parallel work, durable waits, or approvals clearly help.
- Do not create a plan, list tools, or invent tasks.
- No markdown outside the JSON object.`;

export function planningGateShortcut(options: {
  userText: string;
  mode?: string;
}): PlanningGateResult | null {
  const text = options.userText.trim();
  const mode = options.mode ?? "agent";

  if (!text) {
    return { needsPlanning: false, reason: "empty_message" };
  }
  if (mode === "ask") {
    return { needsPlanning: false, reason: "ask_mode" };
  }
  if (mode === "plan") {
    return { needsPlanning: true, reason: "plan_mode" };
  }
  return null;
}

export function parsePlanningGateResult(raw: unknown): PlanningGateResult {
  if (raw == null) {
    return { needsPlanning: false, reason: "gate_parse_empty" };
  }
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1]!.trim() : trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return { needsPlanning: false, reason: "gate_parse_error" };
    }
    try {
      obj = JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return { needsPlanning: false, reason: "gate_parse_error" };
    }
  }
  if (!obj || typeof obj !== "object") {
    return { needsPlanning: false, reason: "gate_parse_error" };
  }
  const rec = obj as Record<string, unknown>;
  const needsPlanning = rec.needsPlanning === true;
  const reason =
    typeof rec.reason === "string" && rec.reason.trim()
      ? rec.reason.trim().slice(0, GATE_REASON_MAX)
      : needsPlanning
        ? "needs_planning"
        : "direct";
  return { needsPlanning, reason };
}

export function resolvePlanningGate(options: {
  userText: string;
  mode?: string;
  llmRaw?: unknown;
}): PlanningGateResult {
  const shortcut = planningGateShortcut(options);
  if (shortcut) return shortcut;
  if (options.llmRaw !== undefined) {
    return parsePlanningGateResult(options.llmRaw);
  }
  return { needsPlanning: false, reason: "default_direct" };
}
