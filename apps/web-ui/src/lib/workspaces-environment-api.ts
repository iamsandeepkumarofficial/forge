import { BASE_URL } from "./projects-api/shared.js";

const HTTP_NO_CONTENT = 204;

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

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    void 0;
  }
  return `Request failed (${res.status})`;
}

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
