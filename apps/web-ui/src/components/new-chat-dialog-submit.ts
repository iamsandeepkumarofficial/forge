import {
  createChat,
  createLinkedItem,
  uploadAttachment,
  type ChatFeatureType
} from "../lib/projects-api.js";
import type { ChatPriority, PendingLink } from "./new-chat-dialog-shared.js";

export async function submitNewChat(options: {
  projectId: string;
  title: string;
  type: ChatFeatureType;
  priority: ChatPriority;
  dueDate: string;
  parentId: string;
  description: string;
  workflowId: string;
  files: File[];
  links: PendingLink[];
  onCreated: () => void | Promise<void>;
  onClose: () => void;
  setError: (value: string | null) => void;
}): Promise<void> {
  if (!options.workflowId.trim()) {
    options.setError("Select a workflow");
    return;
  }
  const chat = await createChat(options.projectId, {
    title: options.title.trim() || "New Chat",
    type: options.type,
    priority: options.priority,
    dueDate: options.dueDate || null,
    parentId: options.parentId || undefined,
    description: options.description.trim() || undefined,
    workflowId: options.workflowId.trim()
  });
  const chatId = chat?.id as string | undefined;
  if (!chatId) {
    throw new Error("Ticket created but no id returned");
  }
  const failures: string[] = [];
  for (const file of options.files) {
    try {
      await uploadAttachment({
        projectId: options.projectId,
        chatId,
        file
      });
    } catch (err) {
      failures.push(
        `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`
      );
    }
  }
  for (const link of options.links) {
    try {
      await createLinkedItem({
        projectId: options.projectId,
        chatId,
        label: link.label,
        url: link.url
      });
    } catch (err) {
      failures.push(
        `${link.label}: ${err instanceof Error ? err.message : "link failed"}`
      );
    }
  }
  await options.onCreated();
  if (failures.length > 0) {
    options.setError(
      `Ticket created, but some extras failed:\n${failures.join("\n")}`
    );
    return;
  }
  options.onClose();
}
