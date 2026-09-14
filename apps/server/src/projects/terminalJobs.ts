import fs from "node:fs/promises";
import path from "node:path";
import {
  isBackgroundJobRunning,
  readBackgroundJobLogs,
  sanitizeJobName,
  stopBackgroundJob
} from "./backgroundJob.js";
import {
  dockerExec,
  readFileFromSandbox,
  writeFileToSandbox
} from "./sandboxExec.js";
import { isHostSession } from "./sandboxRuntime/resolve.js";

export type TerminalJobMeta = {
  command: string;
  cwd: string;
  startedAt: string;
};

export type TerminalJobStatus = {
  name: string;
  running: boolean;
  command?: string;
  cwd?: string;
  startedAt?: string;
};

function metaPath(options: { name: string; workspaceRoot?: string }): string {
  const base = `forge-term-${sanitizeJobName(options.name)}.meta`;
  if (options.workspaceRoot) {
    return path.join(options.workspaceRoot, ".forge-runtime", base);
  }
  return `/tmp/${base}`;
}

async function hostWorkspaceRoot(
  containerName: string,
  sessionId?: string
): Promise<string | undefined> {
  if (sessionId && (await isHostSession(sessionId))) return containerName;
  return undefined;
}

export async function writeTerminalJobMeta(options: {
  containerName: string;
  name: string;
  meta: TerminalJobMeta;
  sessionId?: string;
}): Promise<void> {
  const workspaceRoot = await hostWorkspaceRoot(
    options.containerName,
    options.sessionId
  );
  const absPath = metaPath({ name: options.name, workspaceRoot });
  const content = `${JSON.stringify(options.meta)}\n`;
  if (workspaceRoot) {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, "utf8");
    return;
  }
  await writeFileToSandbox({
    container: options.containerName,
    sessionId: options.sessionId ?? "",
    absPath,
    content
  });
}

export async function readTerminalJobMeta(options: {
  containerName: string;
  name: string;
  sessionId?: string;
}): Promise<TerminalJobMeta | null> {
  const workspaceRoot = await hostWorkspaceRoot(
    options.containerName,
    options.sessionId
  );
  const absPath = metaPath({ name: options.name, workspaceRoot });
  let raw: string | null;
  if (workspaceRoot) {
    try {
      raw = await fs.readFile(absPath, "utf8");
    } catch {
      raw = null;
    }
  } else {
    raw = await readFileFromSandbox({
      container: options.containerName,
      absPath,
      sessionId: options.sessionId ?? ""
    });
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TerminalJobMeta;
    if (typeof parsed.command !== "string" || typeof parsed.cwd !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function listTerminalJobNames(
  containerName: string,
  sessionId?: string
): Promise<string[]> {
  const workspaceRoot = await hostWorkspaceRoot(containerName, sessionId);
  const names = new Set<string>();
  if (workspaceRoot) {
    const dir = path.join(workspaceRoot, ".forge-runtime");
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }
    for (const name of entries) {
      const m = name.match(/^forge-term-(.+)\.(?:pid|log|meta)$/);
      if (m?.[1]) names.add(m[1]);
    }
    return [...names].sort();
  }
  const r = await dockerExec({
    container: containerName,
    sessionId,
    argv: [
      "sh",
      "-c",
      "ls -1 /tmp/forge-term-*.pid /tmp/forge-term-*.log /tmp/forge-term-*.meta 2>/dev/null"
    ]
  });
  for (const line of r.stdout.split("\n")) {
    const m = line.trim().match(/forge-term-(.+)\.(?:pid|log|meta)$/);
    if (m?.[1]) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

export async function listTerminalJobStatuses(
  containerName: string,
  sessionId?: string
): Promise<TerminalJobStatus[]> {
  const names = await listTerminalJobNames(containerName, sessionId);
  return Promise.all(
    names.map(async (name) => {
      const [running, meta] = await Promise.all([
        isBackgroundJobRunning({
          containerName,
          kind: "term",
          name,
          sessionId
        }),
        readTerminalJobMeta({ containerName, name, sessionId })
      ]);
      return {
        name,
        running,
        command: meta?.command,
        cwd: meta?.cwd,
        startedAt: meta?.startedAt
      };
    })
  );
}

export async function terminalJobLogs(options: {
  containerName: string;
  name: string;
  tail?: number;
  sessionId?: string;
}): Promise<string> {
  return readBackgroundJobLogs({
    containerName: options.containerName,
    kind: "term",
    name: options.name,
    tail: options.tail,
    sessionId: options.sessionId
  });
}

export async function stopTerminalJob(options: {
  containerName: string;
  name: string;
  sessionId?: string;
}): Promise<void> {
  await stopBackgroundJob({
    containerName: options.containerName,
    kind: "term",
    name: options.name,
    sessionId: options.sessionId
  });
}
