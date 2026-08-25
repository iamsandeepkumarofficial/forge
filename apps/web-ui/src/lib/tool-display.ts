import type { UiChatMessage } from "./chat-agent.js";

const N_5 = 5;

export type ToolPart = {
  type: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
  result?: unknown;
  state?: string;
  errorText?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
};
const DIFF_PREVIEW_MAX_LINES = 80;
export function toolPartsOf(parts: unknown): ToolPart[] {
  if (!Array.isArray(parts)) return [];
  return parts.filter((p) => {
    if (!p || typeof p !== "object") return false;
    const t =
      typeof (
        p as {
          type?: unknown;
        }
      ).type === "string"
        ? String(
            (
              p as {
                type: string;
              }
            ).type
          )
        : "";
    return (
      t === "tool-invocation" || t === "dynamic-tool" || t.startsWith("tool-")
    );
  }) as ToolPart[];
}
export function toolPartName(p: ToolPart): string {
  if (p.toolName) return p.toolName;
  if (typeof p.type === "string" && p.type.startsWith("tool-"))
    return p.type.slice(N_5);
  return "tool";
}
export function stringifyToolValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
export function mergeSessionMessagesForUi(
  rows: UiChatMessage[]
): UiChatMessage[] {
  const resultsByCallId = new Map<
    string,
    {
      output: unknown;
      success?: boolean;
      errorText?: string;
      metadata?: Record<string, unknown>;
    }
  >();
  for (const m of rows) {
    if (m.role !== "tool") continue;
    for (const part of m.parts) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type !== "tool-result") continue;
      const id = typeof p.toolCallId === "string" ? p.toolCallId : "";
      if (!id) continue;
      resultsByCallId.set(id, {
        output: p.output,
        success: typeof p.success === "boolean" ? p.success : undefined,
        errorText: typeof p.errorText === "string" ? p.errorText : undefined,
        metadata:
          p.metadata && typeof p.metadata === "object"
            ? (p.metadata as Record<string, unknown>)
            : undefined
      });
    }
  }
  const out: UiChatMessage[] = [];
  for (const m of rows) {
    if (m.role === "tool" || m.role === "system") continue;
    if (m.role !== "assistant") {
      out.push(m);
      continue;
    }
    const parts = m.parts.map((part) => {
      if (!part || typeof part !== "object") return part;
      const p = part as Record<string, unknown>;
      if (p.type !== "tool-invocation") return part;
      const id = typeof p.toolCallId === "string" ? p.toolCallId : "";
      const result = id ? resultsByCallId.get(id) : undefined;
      if (!result) return part;
      return {
        ...p,
        state: "result",
        output: result.output,
        ...(result.success === undefined ? {} : { success: result.success }),
        ...(result.errorText ? { errorText: result.errorText } : {}),
        ...(result.metadata ? { metadata: result.metadata } : {})
      };
    });
    out.push({ ...m, parts });
  }
  return out;
}
export function applyLiveToolEvent(options: {
  prev: ToolPart[];
  eventType: "tool_call" | "tool_result";
  payload: Record<string, unknown>;
}): ToolPart[] {
  const { prev, eventType, payload } = options;
  const toolCallId =
    typeof payload.toolCallId === "string" ? payload.toolCallId : undefined;
  const toolName = String(payload.toolName ?? "tool");
  if (eventType === "tool_call") {
    return [
      ...prev,
      {
        type: "tool-invocation",
        toolCallId,
        toolName,
        args: payload.args,
        state: "call"
      }
    ];
  }
  if (toolCallId) {
    let matched = false;
    const next = prev.map((p) => {
      if (matched) return p;
      if (
        p.toolCallId === toolCallId ||
        (!p.toolCallId && p.toolName === toolName && p.state === "call")
      ) {
        matched = true;
        return {
          ...p,
          toolCallId,
          toolName: p.toolName ?? toolName,
          output: payload.output,
          state: "result",
          ...(typeof payload.success === "boolean"
            ? { success: payload.success }
            : {}),
          ...(typeof payload.error === "string"
            ? { errorText: payload.error }
            : {}),
          ...(payload.metadata && typeof payload.metadata === "object"
            ? { metadata: payload.metadata as Record<string, unknown> }
            : {})
        };
      }
      return p;
    });
    if (matched) return next;
  }
  return [
    ...prev,
    {
      type: "tool-invocation",
      toolCallId,
      toolName,
      output: payload.output,
      state: "result",
      ...(typeof payload.success === "boolean"
        ? { success: payload.success }
        : {}),
      ...(payload.metadata && typeof payload.metadata === "object"
        ? { metadata: payload.metadata as Record<string, unknown> }
        : {})
    }
  ];
}
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
function linesOf(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}
function truncateDiffLines(
  lines: string[],
  max = DIFF_PREVIEW_MAX_LINES
): {
  text: string;
  truncated: boolean;
  totalLines: number;
} {
  if (lines.length <= max) {
    return {
      text: lines.join("\n"),
      truncated: false,
      totalLines: lines.length
    };
  }
  return {
    text: [...lines.slice(0, max), `… ${lines.length - max} more lines`].join(
      "\n"
    ),
    truncated: true,
    totalLines: lines.length
  };
}
export type ToolDiffPreview = {
  path: string;
  kind: "edit" | "write";
  diffText: string;
  totalLines: number;
};
export function synthesizeToolDiff(
  toolName: string,
  args: unknown
): ToolDiffPreview | null {
  const record = asRecord(args);
  if (!record) return null;
  const path = typeof record.path === "string" ? record.path : "";
  if (!path) return null;
  if (toolName === "edit_file") {
    const oldString =
      typeof record.oldString === "string" ? record.oldString : null;
    const newString =
      typeof record.newString === "string" ? record.newString : null;
    if (oldString === null || newString === null) return null;
    const oldLines = linesOf(oldString);
    const newLines = linesOf(newString);
    const hunk: string[] = [
      `--- a/${path}`,
      `+++ b/${path}`,
      `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
      ...oldLines.map((l) => `-${l}`),
      ...newLines.map((l) => `+${l}`)
    ];
    return {
      path,
      kind: "edit",
      diffText: hunk.join("\n"),
      totalLines: hunk.length
    };
  }
  if (toolName === "write_file") {
    const content = typeof record.content === "string" ? record.content : null;
    if (content === null) return null;
    const contentLines = linesOf(content);
    const hunk: string[] = [
      `--- /dev/null`,
      `+++ b/${path}`,
      `@@ -0,0 +1,${contentLines.length} @@`,
      ...contentLines.map((l) => `+${l}`)
    ];
    return {
      path,
      kind: "write",
      diffText: hunk.join("\n"),
      totalLines: hunk.length
    };
  }
  return null;
}
export function truncateDiffText(
  diffText: string,
  maxLines = DIFF_PREVIEW_MAX_LINES
): {
  text: string;
  truncated: boolean;
} {
  const lines = linesOf(diffText);
  const result = truncateDiffLines(lines, maxLines);
  return { text: result.text, truncated: result.truncated };
}
