import { BASE_URL } from "./projects-api/shared.js";

export type WorkspaceRoute = {
  pathPrefix: string;
  target: string;
  stripPrefix?: boolean;
};

export type WorkspaceSummary = {
  id: string;
  userId: string;
  name: string;
  routes: WorkspaceRoute[];
  createdAt: string;
  lastActivityAt: string;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  projectId: string;
  repoName: string;
  sortOrder: number;
  dependsOn: string[];
  env: Record<string, string>;
  createdAt: string;
  project: {
    id: string;
    name: string;
    source: string;
    dedupeKey: string;
    status: string;
  };
};

export type WorkspaceDetail = WorkspaceSummary & {
  members: WorkspaceMember[];
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const res = await fetch(`${BASE_URL}/api/workspaces`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { workspaces: WorkspaceSummary[] };
  return body.workspaces ?? [];
}

export async function getWorkspace(
  workspaceId: string
): Promise<WorkspaceDetail> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function createWorkspace(name: string): Promise<WorkspaceDetail> {
  const res = await fetch(`${BASE_URL}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function updateWorkspace(
  workspaceId: string,
  patch: { name?: string; routes?: WorkspaceRoute[] }
): Promise<WorkspaceDetail> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}`, {
    method: "DELETE"
  });
  if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}

export async function addWorkspaceProject(
  workspaceId: string,
  input: {
    projectId: string;
    repoName?: string;
    dependsOn?: string[];
    env?: Record<string, string>;
    sortOrder?: number;
  }
): Promise<WorkspaceDetail> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function updateWorkspaceProject(
  workspaceId: string,
  projectId: string,
  patch: {
    repoName?: string;
    dependsOn?: string[];
    env?: Record<string, string>;
    sortOrder?: number;
  }
): Promise<WorkspaceDetail> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/projects/${projectId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function removeWorkspaceProject(
  workspaceId: string,
  projectId: string
): Promise<WorkspaceDetail> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/projects/${projectId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDetail;
}

export async function createWorkspaceChat(
  workspaceId: string,
  title?: string
): Promise<{ id: string; sessionId: string; title: string }> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {})
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    id: string;
    sessionId: string;
    title: string;
  };
}

export async function listWorkspaceChats(
  workspaceId: string
): Promise<Array<{ id: string; sessionId: string; title: string }>> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/chats`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    chats: Array<{ id: string; sessionId: string; title: string }>;
  };
  return body.chats ?? [];
}

export async function fetchWorkspaceChat(
  workspaceId: string,
  chatId: string
): Promise<{
  id: string;
  sessionId: string;
  title: string;
  kind?: "ticket" | "workbench";
}> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/chats/${chatId}`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    id: string;
    sessionId: string;
    title: string;
    kind?: "ticket" | "workbench";
  };
}
