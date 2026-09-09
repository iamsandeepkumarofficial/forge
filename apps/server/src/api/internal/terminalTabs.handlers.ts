import type { Request, Response } from "express";
import { listAppRunningFlags } from "../../projects/appRunner.js";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import {
  killShellWindow,
  listTmuxWindows,
  newShellWindow
} from "../../projects/sessionPty.js";
import { mergeTerminalTabs } from "../../projects/terminalTabs.js";

const N_400 = 400;
const N_500 = 500;

function sessionIdFrom(req: Request): string {
  const q =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (q) return q;
  return typeof req.body?.sessionId === "string"
    ? req.body.sessionId.trim()
    : "";
}

export async function handleTerminalTabs(
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
    const [shells, apps] = await Promise.all([
      listTmuxWindows(containerName, sessionId),
      listAppRunningFlags(sessionId)
    ]);
    res.json({ tabs: mergeTerminalTabs({ shells, apps }) });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleTerminalTabCreate(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  try {
    const { containerName } = await resolveSandbox(sessionId);
    const tabId = await newShellWindow({
      container: containerName,
      sessionId,
      name: name || undefined
    });
    res.json({
      tabId,
      kind: "shell",
      tab: {
        id: tabId,
        kind: "shell",
        label: tabId === "main" ? "Shell" : tabId,
        running: false,
        closable: true
      }
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleTerminalTabDelete(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = sessionIdFrom(req);
  const tabId = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!sessionId || !tabId) {
    res.status(N_400).json({ error: "sessionId and tab id required" });
    return;
  }
  if (tabId.startsWith("app:")) {
    res.status(N_400).json({ error: "Only shell tabs can be deleted" });
    return;
  }
  try {
    const { containerName } = await resolveSandbox(sessionId);
    await killShellWindow({
      container: containerName,
      sessionId,
      windowName: tabId
    });
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
