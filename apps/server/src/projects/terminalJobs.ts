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
};

function metaPath(name: string): string {
  return `/tmp/forge-term-${sanitizeJobName(name)}.meta`;
}

export async function writeTerminalJobMeta(options: {
  containerName: string;
  name: string;
  meta: TerminalJobMeta;
}): Promise<void> {
  await writeFileToSandbox({
    container: options.containerName,
    absPath: metaPath(options.name),
    content: `${JSON.stringify(options.meta)}\n`
  });
}

export async function readTerminalJobMeta(options: {
  containerName: string;
  name: string;
}): Promise<TerminalJobMeta | null> {
  const raw = await readFileFromSandbox(
    options.containerName,
    metaPath(options.name)
  );
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
  containerName: string
): Promise<string[]> {
  const r = await dockerExec({
    container: containerName,
    argv: [
      "sh",
      "-c",
      "ls -1 /tmp/forge-term-*.pid /tmp/forge-term-*.log /tmp/forge-term-*.meta 2>/dev/null"
    ]
  });
  const names = new Set<string>();
  for (const line of r.stdout.split("\n")) {
    const m = line.trim().match(/forge-term-(.+)\.(?:pid|log|meta)$/);
    if (m?.[1]) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

export async function listTerminalJobStatuses(
  containerName: string
): Promise<TerminalJobStatus[]> {
  const names = await listTerminalJobNames(containerName);
  return Promise.all(
    names.map(async (name) => {
      const [running, meta] = await Promise.all([
        isBackgroundJobRunning({ containerName, kind: "term", name }),
        readTerminalJobMeta({ containerName, name })
      ]);
      return {
        name,
        running,
        command: meta?.command,
        cwd: meta?.cwd
      };
    })
  );
}

export async function terminalJobLogs(options: {
  containerName: string;
  name: string;
  tail?: number;
}): Promise<string> {
  return readBackgroundJobLogs({
    containerName: options.containerName,
    kind: "term",
    name: options.name,
    tail: options.tail
  });
}

export async function stopTerminalJob(options: {
  containerName: string;
  name: string;
}): Promise<void> {
  await stopBackgroundJob({
    containerName: options.containerName,
    kind: "term",
    name: options.name
  });
}
