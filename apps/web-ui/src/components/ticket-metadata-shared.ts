import type { ChatFeatureType } from "@/lib/projects-api";

export interface TicketSummary {
  id: string;
  title: string;
  type: ChatFeatureType;
  dueDate?: string | null;
  parentId?: string | null;
}

export interface TicketMetadataPanelProps {
  projectId: string;
  chat: TicketSummary;
  allChats: TicketSummary[];
  onUpdated?: () => void;
  hideHeading?: boolean;
}
