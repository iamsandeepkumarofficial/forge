import type { Request, Response } from "express";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import {
  listTerminalJobStatuses,
  stopTerminalJob,
  terminalJobLogs
} from "../../projects/terminalJobs.js";

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
    const jobs = await listTerminalJobStatuses(containerName);
    res.json({ jobs });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleTerminalLogs(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    const { containerName } = await resolveSandbox(sessionId);
    if (!name) {
      await sendAllTerminalLogs(res, containerName);
      return;
    }
    const logs = await terminalJobLogs({ containerName, name });
    res.type("text/plain; charset=utf-8").send(logs);
  } catch (err) {
    res
      .status(N_500)
      .type("text/plain; charset=utf-8")
      .send(err instanceof Error ? err.message : String(err));
  }
}

async function sendAllTerminalLogs(
  res: Response,
  containerName: string
): Promise<void> {
  const jobs = await listTerminalJobStatuses(containerName);
  const entries = await Promise.all(
    jobs.map(async (job) => {
      const text = await terminalJobLogs({
        containerName,
        name: job.name
      });
      return [job.name, text] as const;
    })
  );
  res.json({ jobs, logs: Object.fromEntries(entries) });
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
    await stopTerminalJob({ containerName, name });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
