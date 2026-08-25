import { BASE_URL, ConnectProjectError, pocToken } from "./shared.js";

export type ActivityFilter = "all" | "comments" | "history" | "worklog";
export interface ActivityEntry {
  id: string;
  kind: "comment" | "history" | "worklog";
  actorType: "agent" | "builder" | "system";
  agentId?: string | null;
  userId?: string | null;
  summary: string;
  detail?: unknown;
  createdAt: string;
}
export interface ActivityFeed {
  filter: ActivityFilter;
  entries: ActivityEntry[];
  nextBefore: string | null;
}
export async function getActivity(options: {
  projectId: string;
  chatId: string;
  filter?: ActivityFilter;
}): Promise<ActivityFeed> {
  const { projectId, chatId, filter = "all" } = options;
  const params = new URLSearchParams({ filter });
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/activity?${params}`,
    { headers: { Authorization: `Bearer ${pocToken()}` } }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to fetch activity");
  }
  return response.json();
}
