import type { Request, Response } from "express";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import {
  listTerminalJobStatuses,
  stopTerminalJob
} from "../../projects/terminalJobs.js";
import { runTerminalInSession } from "../../tools/runTerminal.tool.js";

const N_400 = 400;
const N_500 = 500;

function sessionIdFrom(req: Request): string {
  const q =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (q) {
    return q;
  }
  return typeof req.body?.sessionId === "string"
    ? req.body.sessionId.trim()
    : "";
}

export async function handleTerminalJobs(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    const { containerName } = await resolveSandbox(sessionId);
    const jobs = await listTerminalJobStatuses(containerName, sessionId);
    jobs.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    res.json({ jobs });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleTerminalStop(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!sessionId || !name) {
    res.status(N_400).json({ error: "sessionId and name required" });
    return;
  }
  try {
    const { containerName } = await resolveSandbox(sessionId);
    await stopTerminalJob({ containerName, name, sessionId });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleTerminalRun(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  const command =
    typeof req.body?.command === "string" ? req.body.command.trim() : "";
  if (!sessionId || !command) {
    res.status(N_400).json({ error: "sessionId and command required" });
    return;
  }
  const workingDirectory =
    typeof req.body?.workingDirectory === "string"
      ? req.body.workingDirectory.trim()
      : undefined;
  const jobName =
    typeof req.body?.jobName === "string" ? req.body.jobName.trim() : undefined;
  try {
    const result = await runTerminalInSession({
      sessionId,
      command,
      background: Boolean(req.body?.background),
      workingDirectory: workingDirectory || undefined,
      jobName: jobName || undefined
    });
    res.json(result);
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
