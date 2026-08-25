import type { ModelMessage } from "ai";
import type { StoredMessage } from "./chatApi.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function textFromParts(parts: unknown[]): string {
  return parts
    .filter(
      (
        p
      ): p is {
        type: string;
        text?: string;
      } => isRecord(p)
    )
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}

function toolInvocationParts(parts: unknown[]): Record<string, unknown>[] {
  return parts.filter(
    (p): p is Record<string, unknown> =>
      isRecord(p) && p.type === "tool-invocation"
  );
}

type AssistantContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
      providerOptions?: {
        google: {
          thoughtSignature: string;
        };
      };
    };

function assistantToolCallContent(opts: {
  text: string;
  toolParts: Record<string, unknown>[];
}): AssistantContentPart[] {
  const content: AssistantContentPart[] = [];
  if (opts.text) content.push({ type: "text", text: opts.text });
  for (const tp of opts.toolParts) {
    const thoughtSignature =
      typeof tp.thoughtSignature === "string" && tp.thoughtSignature.length > 0
        ? tp.thoughtSignature
        : undefined;
    content.push({
      type: "tool-call",
      toolCallId: String(tp.toolCallId ?? ""),
      toolName: String(tp.toolName ?? ""),
      input: tp.args ?? {},
      ...(thoughtSignature
        ? {
            providerOptions: {
              google: { thoughtSignature }
            }
          }
        : {})
    });
  }
  return content;
}

function pushToolRoleMessages(out: ModelMessage[], parts: unknown[]): void {
  for (const p of parts) {
    if (!isRecord(p) || p.type !== "tool-result") continue;
    out.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: String(p.toolCallId ?? ""),
          toolName: String(p.toolName ?? "tool"),
          output: { type: "text", value: String(p.output ?? "") }
        }
      ]
    });
  }
}

function collectPendingToolCalls(
  content: unknown,
  pending: Map<string, string>
): void {
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (!isRecord(part) || part.type !== "tool-call") continue;
    const toolCallId = String(part.toolCallId ?? "");
    if (toolCallId) {
      pending.set(toolCallId, String(part.toolName ?? "tool") || "tool");
    }
  }
}

function clearResolvedToolCalls(
  content: unknown,
  pending: Map<string, string>
): void {
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (!isRecord(part) || part.type !== "tool-result") continue;
    pending.delete(String(part.toolCallId ?? ""));
  }
}

function flushOrphanToolResults(
  out: ModelMessage[],
  pending: Map<string, string>
): void {
  if (pending.size === 0) return;
  out.push({
    role: "tool",
    content: [...pending.entries()].map(([toolCallId, toolName]) => ({
      type: "tool-result" as const,
      toolCallId,
      toolName,
      output: {
        type: "text" as const,
        value: "(tool call interrupted — result missing from prior turn)"
      }
    }))
  });
  pending.clear();
}

export function sanitizeToolCallPairs(
  messages: ModelMessage[]
): ModelMessage[] {
  const out: ModelMessage[] = [];
  const pending = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "user" || m.role === "system") {
      flushOrphanToolResults(out, pending);
      out.push(m);
      continue;
    }
    if (m.role === "assistant") {
      out.push(m);
      collectPendingToolCalls(m.content, pending);
      continue;
    }
    if (m.role === "tool") {
      out.push(m);
      clearResolvedToolCalls(m.content, pending);
    }
  }
  flushOrphanToolResults(out, pending);
  return out;
}

export function withFirstTurnRepoEval(
  messages: StoredMessage[]
): StoredMessage[] {
  const hasPrior = messages.some(
    (m) => m.role === "assistant" || m.role === "tool"
  );
  if (hasPrior) {
    return messages;
  }
  return [
    {
      id: "repo-readiness-eval",
      role: "user",
      parts: [
        {
          type: "text",
          text: [
            "[Repo readiness eval] Read ## Repo setup in the system prompt (already evaluated).",
            "If not agent-ready: inspect the repo, upsert_launch_app, then preview_start when you need to run an app.",
            "Never use run_terminal for npm/pnpm/yarn run dev — it times out. Use preview_start.",
            "Then continue with the user's request."
          ].join(" ")
        }
      ]
    },
    ...messages
  ];
}

export function partsToModelMessages(
  messages: StoredMessage[]
): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of messages) {
    const parts = Array.isArray(m.parts) ? m.parts : [];
    const text = textFromParts(parts);
    if (m.role === "user") {
      out.push({ role: "user", content: text || "(empty)" });
    } else if (m.role === "assistant") {
      const toolParts = toolInvocationParts(parts);
      if (toolParts.length > 0) {
        out.push({
          role: "assistant",
          content: assistantToolCallContent({ text, toolParts })
        });
      } else {
        out.push({ role: "assistant", content: text || "" });
      }
    } else if (m.role === "tool") {
      pushToolRoleMessages(out, parts);
    }
  }
  return sanitizeToolCallPairs(out);
}
