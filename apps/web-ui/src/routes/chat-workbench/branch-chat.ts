import { copySessionMessagesUntil } from "../../lib/chat-agent.js";
import { createWorkbenchSession } from "../../lib/projects-api.js";
import { createWorkspaceChat } from "../../lib/workspaces-api.js";
import { titleFromPrompt } from "../chats-storage.js";

export async function branchChatFromMessage(options: {
  sourceSessionId: string;
  untilMessageId: string;
  assistantText: string;
  projectId: string;
  workspaceId?: string;
}): Promise<string> {
  const title = titleFromPrompt(
    options.assistantText.trim() || "Branched chat"
  );
  if (options.workspaceId) {
    const chat = await createWorkspaceChat({
      workspaceId: options.workspaceId,
      title
    });
    await copySessionMessagesUntil({
      sourceSessionId: options.sourceSessionId,
      targetSessionId: chat.sessionId,
      untilMessageId: options.untilMessageId
    });
    return `/workspaces/${options.workspaceId}/chats/${chat.id}`;
  }
  if (!options.projectId) {
    throw new Error("project or workspace required to branch");
  }
  const session = await createWorkbenchSession({
    projectId: options.projectId,
    title
  });
  await copySessionMessagesUntil({
    sourceSessionId: options.sourceSessionId,
    targetSessionId: session.sessionId,
    untilMessageId: options.untilMessageId
  });
  return `/projects/${options.projectId}/chats/${session.id}`;
}
