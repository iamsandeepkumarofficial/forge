import type { ChatFeatureType } from "../lib/projects-api.js";

export type ChatPriority = "low" | "medium" | "high" | "urgent";
export const DEFAULT_WORKFLOW_ID = "sdlc";

export interface ExistingChat {
  id: string;
  title: string;
  parentId?: string | null;
}

export interface PendingLink {
  id: string;
  label: string;
  url: string;
}

export interface NewChatDialogProps {
  projectId: string;
  existingChats: ExistingChat[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

export type { ChatFeatureType };
