import { createWorkbenchSession } from "../../lib/projects-api.js";
import { createWorkspaceChat } from "../../lib/workspaces-api.js";
import { titleFromPrompt } from "../chats-storage.js";

export type BranchedChatTarget = {
  href: string;
  targetSessionId: string;
};

export type BranchCopyState = {
  sourceSessionId: string;
  targetSessionId: string;
  untilMessageId: string;
};

export function readBranchCopyState(state: unknown): BranchCopyState | null {
  if (!state || typeof state !== "object" || !("branchCopy" in state)) {
    return null;
  }
  const raw = (state as { branchCopy?: unknown }).branchCopy;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const sourceSessionId =
    typeof row.sourceSessionId === "string" ? row.sourceSessionId : "";
  const targetSessionId =
    typeof row.targetSessionId === "string" ? row.targetSessionId : "";
  const untilMessageId =
    typeof row.untilMessageId === "string" ? row.untilMessageId : "";
  if (!sourceSessionId || !targetSessionId || !untilMessageId) return null;
  return { sourceSessionId, targetSessionId, untilMessageId };
}

export async function createBranchedChat(options: {
  assistantText: string;
  projectId: string;
  workspaceId?: string;
}): Promise<BranchedChatTarget> {
  const title = titleFromPrompt(
    options.assistantText.trim() || "Branched chat"
  );
  if (options.workspaceId) {
    const chat = await createWorkspaceChat({
      workspaceId: options.workspaceId,
      title
    });
    return {
      href: `/workspaces/${options.workspaceId}/chats/${chat.id}`,
      targetSessionId: chat.sessionId
    };
  }
  if (!options.projectId) {
    throw new Error("project or workspace required to branch");
  }
  const session = await createWorkbenchSession({
    projectId: options.projectId,
    title
  });
  return {
    href: `/projects/${options.projectId}/chats/${session.id}`,
    targetSessionId: session.sessionId
  };
}
