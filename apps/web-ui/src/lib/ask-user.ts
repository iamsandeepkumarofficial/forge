import { toolPartName, type ToolPart } from "./tool-display.js";
import type { UiChatMessage } from "./chat-agent.js";

export type AskUserOption = { id: string; label: string };
export type AskUserField = {
  id: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  value?: string;
  group?: string;
  type?: "text" | "secret" | "boolean";
};

export type AskUserProposal = {
  toolCallId: string | null;
  kind: "mcq" | "form";
  prompt: string;
  options: AskUserOption[];
  fields: AskUserField[];
};

const ASK_USER_ANSWER_PREFIX = "User answer (ask_user)";

export function isAskUserAnswerText(text: string): boolean {
  return text.trimStart().startsWith(ASK_USER_ANSWER_PREFIX);
}

function messageText(message: UiChatMessage): string {
  return message.parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
}

function normalizeField(raw: unknown): AskUserField | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (typeof f.id !== "string" || typeof f.label !== "string") return null;
  if (!f.id.trim() || !f.label.trim()) return null;
  return {
    id: f.id.trim(),
    label: f.label.trim(),
    ...(f.secret === true ? { secret: true } : {}),
    ...(typeof f.placeholder === "string" && f.placeholder.trim()
      ? { placeholder: f.placeholder.trim() }
      : {}),
    ...(typeof f.value === "string" ? { value: f.value } : {}),
    ...(typeof f.group === "string" && f.group.trim()
      ? { group: f.group.trim() }
      : {}),
    ...(f.type === "text" || f.type === "secret" || f.type === "boolean"
      ? { type: f.type }
      : {})
  };
}

function proposalFromPart(part: ToolPart): AskUserProposal | null {
  if (toolPartName(part) !== "ask_user") return null;
  const meta = part.metadata;
  if (!meta || meta.needsUserInput !== true) return null;
  const kind =
    meta.kind === "form" ? "form" : meta.kind === "mcq" ? "mcq" : null;
  const prompt = typeof meta.prompt === "string" ? meta.prompt.trim() : "";
  if (!kind || !prompt) return null;
  const options = Array.isArray(meta.options)
    ? (meta.options as AskUserOption[]).filter(
        (o) => o && typeof o.id === "string" && typeof o.label === "string"
      )
    : [];
  const fields = Array.isArray(meta.fields)
    ? meta.fields
        .map(normalizeField)
        .filter((f): f is AskUserField => f != null)
    : [];
  if (kind === "mcq" && options.length < 2) return null;
  if (kind === "form" && fields.length < 1) return null;
  return {
    toolCallId: typeof part.toolCallId === "string" ? part.toolCallId : null,
    kind,
    prompt,
    options,
    fields
  };
}

type IndexedProposal = {
  proposal: AskUserProposal;

  atIndex: number;
};

function collectIndexedProposals(
  messages: UiChatMessage[],
  liveToolParts: ToolPart[]
): IndexedProposal[] {
  const out: IndexedProposal[] = [];
  for (let mi = 0; mi < messages.length; mi++) {
    const message = messages[mi]!;
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!part || typeof part !== "object") continue;
      const p = part as ToolPart;
      if (typeof p.type !== "string" || !p.type.includes("tool")) continue;
      const proposal = proposalFromPart(p);
      if (proposal) out.push({ proposal, atIndex: mi });
    }
  }
  for (const part of liveToolParts) {
    const proposal = proposalFromPart(part);
    if (proposal) out.push({ proposal, atIndex: messages.length });
  }
  return out;
}

function hasAnswerAfter(
  messages: UiChatMessage[],
  afterIndex: number
): boolean {
  for (let i = afterIndex + 1; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    if (isAskUserAnswerText(messageText(m))) return true;
  }
  return false;
}

export function findPendingAskUser(options: {
  messages: UiChatMessage[];
  liveToolParts: ToolPart[];
  dismissedIds: ReadonlySet<string>;
}): AskUserProposal | null {
  const indexed = collectIndexedProposals(
    options.messages,
    options.liveToolParts
  );
  for (let i = indexed.length - 1; i >= 0; i--) {
    const { proposal, atIndex } = indexed[i]!;
    const key = askUserProposalKey(proposal);
    if (options.dismissedIds.has(key)) continue;
    if (hasAnswerAfter(options.messages, atIndex)) continue;
    return proposal;
  }
  return null;
}

export function askUserProposalKey(proposal: AskUserProposal): string {
  return proposal.toolCallId ?? `anon:${proposal.kind}:${proposal.prompt}`;
}

export function askUserMcqReply(option: AskUserOption): string {
  return `User answer (ask_user): chose "${option.id}" — ${option.label}`;
}

export function askUserSkipReply(): string {
  return "User answer (ask_user): skipped";
}

export function askUserFormReply(options: {
  fields: AskUserField[];
  values: Record<string, string>;
  savedParamKeys?: string[];
}): string {
  const lines = options.fields.map(
    (f) => `${f.id}: ${options.values[f.id] ?? ""}`
  );
  const saved = options.savedParamKeys?.filter(Boolean) ?? [];
  const header =
    saved.length > 0
      ? `User answer (ask_user) — saved to parameter store: ${saved.join(", ")}.`
      : "User answer (ask_user):";
  return `${header}\n${lines.join("\n")}`;
}

export function askUserInitialValues(
  fields: AskUserField[]
): Record<string, string> {
  const init: Record<string, string> = {};
  for (const f of fields) {
    init[f.id] = typeof f.value === "string" ? f.value : "";
  }
  return init;
}

export function askUserDisplayPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "";
  if (trimmed.includes("|") && /\n\s*\|?\s*-{3,}/.test(trimmed)) {
    const first = trimmed.split(/\n\s*\n/)[0]?.trim() ?? trimmed;
    const sentence = first.split(/(?<=[.!?])\s/)[0] ?? first;
    return sentence.length > 0
      ? `${sentence.replace(/\s+/g, " ").trim()} Details in the fields below.`
      : "Details in the fields below.";
  }
  return trimmed;
}

export function groupAskUserFields(
  fields: AskUserField[]
): Array<{ group: string | null; fields: AskUserField[] }> {
  const order: string[] = [];
  const byGroup = new Map<string, AskUserField[]>();
  const ungrouped: AskUserField[] = [];
  for (const field of fields) {
    const group = field.group?.trim();
    if (!group) {
      ungrouped.push(field);
      continue;
    }
    if (!byGroup.has(group)) {
      order.push(group);
      byGroup.set(group, []);
    }
    byGroup.get(group)!.push(field);
  }
  const sections: Array<{ group: string | null; fields: AskUserField[] }> = [];
  if (ungrouped.length > 0) sections.push({ group: null, fields: ungrouped });
  for (const group of order) {
    sections.push({ group, fields: byGroup.get(group) ?? [] });
  }
  return sections;
}

export function isWorkspaceParamFieldId(id: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(id);
}

export function askUserOtherReply(text: string): string {
  return `User answer (ask_user): other — ${text.trim()}`;
}
