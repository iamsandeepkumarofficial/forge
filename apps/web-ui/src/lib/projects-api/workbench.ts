import { BASE_URL, ConnectProjectError } from "./shared.js";

export type ChatFeatureKind = "ticket" | "workbench";
export interface ProjectWorkbenchSession {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  kind: "workbench";
  sessionId: string;
  branchName: string;
  lastActivityAt: string;
  createdAt: string;
}
export async function createWorkbenchSession(
  projectId: string,
  title?: string
): Promise<ProjectWorkbenchSession> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/workbench-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title })
    }
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to create workbench session");
  }
  return response.json();
}
export async function fetchWorkbenchSessions(
  projectId: string
): Promise<ProjectWorkbenchSession[]> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/workbench-sessions`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to fetch workbench sessions");
  }
  return response.json();
}
