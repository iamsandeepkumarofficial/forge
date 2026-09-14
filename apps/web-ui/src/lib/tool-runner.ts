export function runnerUrl(): string {
  return (
    import.meta.env.VITE_TOOL_RUNNER_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:4000"
  );
}
export type RunnerReposResponse = {
  managedRoot: string;
  repos: string[];
};
export type GithubConnectResponse = {
  path: string;
  alreadyExisted: boolean;
};
function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}
export async function fetchRunnerRepos(
  signal?: AbortSignal
): Promise<RunnerReposResponse> {
  const res = await fetch(`${runnerUrl()}/internal/repos`, {
    method: "GET",
    signal
  });
  const data = (await res.json()) as RunnerReposResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return { managedRoot: data.managedRoot, repos: data.repos ?? [] };
}
export async function connectGithubRepo(options: {
  slug: string;
  shallow: boolean;
  signal?: AbortSignal;
}): Promise<GithubConnectResponse> {
  const { slug, shallow, signal } = options;
  const res = await fetch(`${runnerUrl()}/internal/repos/github`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ slug: slug.trim(), shallow }),
    signal
  });
  const data = (await res.json()) as GithubConnectResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return { path: data.path, alreadyExisted: Boolean(data.alreadyExisted) };
}
export type SessionChangeFile = {
  path: string;
  status: string;
  kind: "added" | "modified" | "deleted" | "renamed" | "untracked" | "other";
};
export type SessionRepoChanges = {
  repo: string;
  worktreePath: string;
  files: SessionChangeFile[];
  error?: string;
};
export async function prepareSessionWorkspace(
  sessionId: string,
  signal?: AbortSignal
): Promise<{
  sessionRoot: string;
}> {
  const res = await fetch(`${runnerUrl()}/internal/prepare`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sessionId }),
    signal
  });
  const data = (await res.json()) as {
    sessionRoot?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return { sessionRoot: data.sessionRoot ?? "" };
}
export async function fetchSessionChanges(
  sessionId: string,
  signal?: AbortSignal
): Promise<{
  sessionRoot: string;
  repos: SessionRepoChanges[];
}> {
  const res = await fetch(
    `${runnerUrl()}/internal/changes?sessionId=${encodeURIComponent(sessionId)}`,
    { signal }
  );
  const data = (await res.json()) as {
    sessionRoot?: string;
    repos?: SessionRepoChanges[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || String(res.status));
  }
  return {
    sessionRoot: data.sessionRoot ?? "",
    repos: Array.isArray(data.repos) ? data.repos : []
  };
}
export async function fetchFileDiff(options: {
  sessionId: string;
  repo: string;
  filePath: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { sessionId, repo, filePath, signal } = options;
  const u = new URL(`${runnerUrl()}/internal/changes/file-diff`);
  u.searchParams.set("sessionId", sessionId);
  u.searchParams.set("repo", repo);
  u.searchParams.set("path", filePath);
  const res = await fetch(u.toString(), {
    signal
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t.trim() || String(res.status));
  }
  return res.text();
}
export async function executeTool(options: {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const { sessionId, toolName, args, signal } = options;
  const res = await fetch(`${runnerUrl()}/internal/tool-execute`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, toolName, args }),
    signal
  });
  const data = (await res.json()) as {
    success?: boolean;
    output?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || data.output || String(res.status));
  }
  return {
    success: Boolean(data.success),
    output: typeof data.output === "string" ? data.output : "",
    metadata: data.metadata
  };
}
export type DirEntry = {
  name: string;
  path: string;
  isDir: boolean;
};
export async function listSandboxDir(options: {
  sessionId: string;
  path: string;
  signal?: AbortSignal;
}): Promise<DirEntry[]> {
  const { sessionId, path, signal } = options;
  const res = await executeTool({
    sessionId,
    toolName: "list_dir",
    args: { path },
    signal
  });
  if (!res.success) {
    throw new Error(res.output || "Failed to list directory");
  }
  const entries = res.metadata?.entries;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(
    (e): e is DirEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as DirEntry).name === "string" &&
      typeof (e as DirEntry).path === "string" &&
      typeof (e as DirEntry).isDir === "boolean"
  );
}
export type AppType = "web" | "api" | "worker";
export type ForgeApp = {
  name: string;
  cwd: string;
  command: string;
  port?: number;
  type: AppType;
};
export type AppStatus = ForgeApp & {
  running: boolean;
  url?: string;
  hostPort?: number;
};
async function appsRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${runnerUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const data = (await res.json()) as T & {
    error?: string;
  };
  if (!res.ok)
    throw new Error(
      (
        data as {
          error?: string;
        }
      ).error || String(res.status)
    );
  return data as T;
}
export function fetchApps(sessionId: string): Promise<{
  exists: boolean;
  apps: AppStatus[];
}> {
  return appsRequest(
    `/internal/apps?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "GET" }
  );
}

export type SessionHealthCheckItem = {
  id: string;
  status: "ok" | "warn" | "fail" | "unknown";
  label: string;
  summary?: string;
};

export type SessionHealthCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail" | "unknown";
  summary: string;
  detail?: string;
  remediation?: string;
  items?: SessionHealthCheckItem[];
};

export type SessionHealthReport = {
  sessionId: string;
  workspaceId: string | null;
  computedAt: string;
  overall: "ok" | "warn" | "fail" | "unknown";
  checks: SessionHealthCheck[];
  runningApps: Array<{
    name: string;
    running: boolean;
    port?: number;
    url?: string;
  }>;
};

export function fetchSessionHealth(
  sessionId: string
): Promise<SessionHealthReport> {
  return appsRequest(
    `/internal/session/health?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "GET" }
  );
}

export function scaffoldApps(sessionId: string): Promise<{
  apps: ForgeApp[];
}> {
  return appsRequest(`/internal/apps/scaffold`, {
    method: "POST",
    body: JSON.stringify({ sessionId })
  });
}
export function saveAppsConfig(
  sessionId: string,
  config: {
    apps: ForgeApp[];
  }
): Promise<{
  exists: boolean;
  apps: AppStatus[];
}> {
  return appsRequest(`/internal/apps/config`, {
    method: "PUT",
    body: JSON.stringify({ sessionId, config })
  });
}
export function runApp(sessionId: string, name: string): Promise<AppStatus> {
  return appsRequest(`/internal/apps/run`, {
    method: "POST",
    body: JSON.stringify({ sessionId, name })
  });
}
export function stopApp(
  sessionId: string,
  name: string
): Promise<{
  ok: boolean;
}> {
  return appsRequest(`/internal/apps/stop`, {
    method: "POST",
    body: JSON.stringify({ sessionId, name })
  });
}
export async function fetchAppLogs(options: {
  sessionId: string;
  name: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { sessionId, name, signal } = options;
  const u = new URL(`${runnerUrl()}/internal/apps/logs`);
  u.searchParams.set("sessionId", sessionId);
  u.searchParams.set("name", name);
  const res = await fetch(u.toString(), {
    signal
  });
  if (!res.ok) throw new Error((await res.text()).trim() || String(res.status));
  return res.text();
}
export async function fetchAllAppLogs(
  sessionId: string,
  signal?: AbortSignal
): Promise<Record<string, string>> {
  const u = new URL(`${runnerUrl()}/internal/apps/logs`);
  u.searchParams.set("sessionId", sessionId);
  const res = await fetch(u.toString(), {
    signal
  });
  if (!res.ok) throw new Error((await res.text()).trim() || String(res.status));
  const body = (await res.json()) as {
    logs?: Record<string, string>;
    error?: string;
  };
  if (body.error && !body.logs) throw new Error(body.error);
  return body.logs && typeof body.logs === "object" ? body.logs : {};
}
