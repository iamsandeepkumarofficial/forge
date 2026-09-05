import { BASE_URL } from "./projects-api/shared.js";

const HTTP_NO_CONTENT = 204;

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
  if (!res.ok && res.status !== HTTP_NO_CONTENT)
    throw new Error(await readError(res));
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

export async function updateWorkspaceProject(options: {
  workspaceId: string;
  projectId: string;
  patch: {
    repoName?: string;
    dependsOn?: string[];
    env?: Record<string, string>;
    sortOrder?: number;
  };
}): Promise<WorkspaceDetail> {
  const { workspaceId, projectId, patch } = options;
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

export type WorkspaceChat = {
  id: string;
  sessionId: string;
  title: string;
  kind?: "ticket" | "workbench";
  branchName?: string;
  lastActivityAt?: string;
  createdAt?: string;
};

function asIso(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return undefined;
}

function normalizeWorkspaceChat(raw: Record<string, unknown>): WorkspaceChat {
  return {
    id: String(raw.id ?? ""),
    sessionId: String(raw.sessionId ?? ""),
    title: typeof raw.title === "string" ? raw.title : "Chat",
    kind:
      raw.kind === "ticket" || raw.kind === "workbench" ? raw.kind : undefined,
    branchName: typeof raw.branchName === "string" ? raw.branchName : undefined,
    lastActivityAt: asIso(raw.lastActivityAt),
    createdAt: asIso(raw.createdAt)
  };
}

export async function createWorkspaceChat(
  workspaceId: string,
  title?: string
): Promise<WorkspaceChat> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {})
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalizeWorkspaceChat((await res.json()) as Record<string, unknown>);
}

export async function listWorkspaceChats(
  workspaceId: string
): Promise<WorkspaceChat[]> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/chats`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { chats?: unknown[] };
  return (body.chats ?? []).map((row) =>
    normalizeWorkspaceChat((row ?? {}) as Record<string, unknown>)
  );
}

export async function fetchWorkspaceChat(
  workspaceId: string,
  chatId: string
): Promise<WorkspaceChat> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/chats/${chatId}`
  );
  if (!res.ok) throw new Error(await readError(res));
  return normalizeWorkspaceChat((await res.json()) as Record<string, unknown>);
}

export async function deleteWorkspaceChat(
  workspaceId: string,
  chatId: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/chats/${chatId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await readError(res));
}

export type WorkspaceHealthFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  repo?: string;
  message: string;
  hint?: string;
};

export type WorkspaceHealthReport = {
  status: "ready" | "blocked" | "warnings" | "computing";
  computedAt?: string;
  members?: unknown[];
  findings?: WorkspaceHealthFinding[];
};

export type WorkspaceHealthResponse = {
  workspaceId: string;
  status: string;
  report: WorkspaceHealthReport | Record<string, unknown>;
  computedAt: string | null;
};

export async function getWorkspaceHealth(
  workspaceId: string
): Promise<WorkspaceHealthResponse> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/health`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceHealthResponse;
}

export async function analyzeWorkspace(
  workspaceId: string
): Promise<WorkspaceHealthResponse> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/analyze`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceHealthResponse;
}

export type WorkspaceParameter = {
  key: string;
  value: string;
  secret: boolean;
  hasValue?: boolean;
};

export async function listWorkspaceParameters(
  workspaceId: string
): Promise<WorkspaceParameter[]> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/parameters`
  );
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { parameters?: WorkspaceParameter[] };
  return body.parameters ?? [];
}

export async function upsertWorkspaceParameter(
  workspaceId: string,
  input: { key: string; value: string; secret?: boolean }
): Promise<WorkspaceParameter> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/parameters`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceParameter;
}

export async function deleteWorkspaceParameter(
  workspaceId: string,
  key: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/parameters/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== HTTP_NO_CONTENT)
    throw new Error(await readError(res));
}

export type WorkspaceDatabaseEngine = {
  id: "postgres" | "mongo";
  label: string;
  image: string;
  envKey: string;
  networkAlias: string;
  hostPort: number;
  engineRunning: boolean;
  attached: boolean;
  database: string | null;
};

export type WorkspaceDatabaseStatus = {
  enabled: boolean;
  network: string;
  engines: WorkspaceDatabaseEngine[];
};

export async function getWorkspaceDatabases(
  workspaceId: string
): Promise<WorkspaceDatabaseStatus> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/databases`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceDatabaseStatus;
}

export async function provisionWorkspaceDatabase(
  workspaceId: string,
  engineId: "postgres" | "mongo"
): Promise<{
  engineId: string;
  label: string;
  image: string;
  database: string;
  envKey: string;
  networkAlias: string;
  hostPort: number;
  reused: boolean;
  pulled: boolean;
}> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/databases`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineId })
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    engineId: string;
    label: string;
    image: string;
    database: string;
    envKey: string;
    networkAlias: string;
    hostPort: number;
    reused: boolean;
    pulled: boolean;
  };
}

export async function detachWorkspaceDatabase(
  workspaceId: string,
  engineId: "postgres" | "mongo"
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/databases/${engineId}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== HTTP_NO_CONTENT)
    throw new Error(await readError(res));
}

export type WorkspaceEnvironmentLaunchApp = {
  name?: string;
  cwd?: string;
  command?: string;
  port?: number;
  type?: string;
  repo?: string;
  [key: string]: unknown;
};

export type WorkspaceEnvironmentStatus = {
  launch: { apps: WorkspaceEnvironmentLaunchApp[] };
  updatedAt: string | null;
  sourceSessionId: string | null;
  depsVolumeName: string;
};

export async function getWorkspaceEnvironment(
  workspaceId: string
): Promise<WorkspaceEnvironmentStatus> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/environment`
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkspaceEnvironmentStatus;
}

export async function clearWorkspaceEnvironmentLaunch(
  workspaceId: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/environment/launch`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== HTTP_NO_CONTENT)
    throw new Error(await readError(res));
}

export async function clearWorkspaceEnvironmentDepsCache(
  workspaceId: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${workspaceId}/environment/deps-cache`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== HTTP_NO_CONTENT)
    throw new Error(await readError(res));
}
