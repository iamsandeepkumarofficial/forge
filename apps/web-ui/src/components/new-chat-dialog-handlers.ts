import { submitNewChat } from "./new-chat-dialog-submit.js";
import type {
  ChatFeatureType,
  ChatPriority,
  PendingLink
} from "./new-chat-dialog-shared.js";

export function buildNewChatSubmitHandler(options: {
  projectId: string;
  title: string;
  type: ChatFeatureType;
  priority: ChatPriority;
  dueDate: string;
  parentId: string;
  description: string;
  workflowId: string;
  executionTarget: "local" | "cloud";
  files: File[];
  links: PendingLink[];
  onCreated: () => void | Promise<void>;
  onClose: () => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
}) {
  return async (e: React.FormEvent) => {
    e.preventDefault();
    options.setLoading(true);
    options.setError(null);
    try {
      await submitNewChat(options);
    } catch (err: unknown) {
      options.setError(
        err instanceof Error ? err.message : "Failed to create ticket"
      );
    } finally {
      options.setLoading(false);
    }
  };
}
