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
            "[Repo readiness eval] Read ## Working repositories, ## Workspace repos, ## Repo setup, ## Workspace setup SOP, ## Environment, and ## Workspace health in the system prompt.",
            "Order: (1) identify stack per member from shadows/inventory (2) invoke_skill for that stack (3) install via run_terminal per skill (ask_user for toolchain if missing) (4) ask_user then upsert_workspace_parameter for env; ask_user then setup_project_infra with userApproved after consent; on missing host binaries use install_project_infra then retry setup (5) upsert_launch_app with cwd under the member (6) preview_start backends before frontends when dependsOn says so.",
            "Never use run_terminal for npm/pnpm/yarn run dev|start or long-running app servers — use preview_start (network plane).",
            "Do not install Postgres/Mongo via run_terminal; use install_project_infra then setup_project_infra after user approval.",
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
