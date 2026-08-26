import type { Request, Response } from "express";
import {
  provisionSessionSandbox,
  getSessionSandboxStatus
} from "../../projects/sessionSandbox.js";
import {
  spawnRepoTarGz,
  promoteToCanonical
} from "../../projects/codeArchive.js";
import {
  listAppStatuses,
  writeForgeConfig,
  runApp,
  stopApp,
  appLogs,
  appLogsForSession,
  autoStartPreview,
  type ForgeConfig
} from "../../projects/appRunner.js";
import { scaffoldForgeConfig } from "../../projects/launchScaffold.js";

const N_400 = 400;
const N_500 = 500;
const N_502 = 502;

function parseLocalFolderSource(
  body: unknown
): { type: "local_folder"; path: string } | undefined {
  if (!body || typeof body !== "object") return undefined;
  const source = (body as { source?: unknown }).source;
  if (!source || typeof source !== "object") return undefined;
  const typed = source as { type?: unknown; path?: unknown };
  if (typed.type !== "local_folder") return undefined;
  if (typeof typed.path !== "string" || !typed.path.trim()) {
    throw new Error('source.path is required when type is "local_folder"');
  }
  return { type: "local_folder", path: typed.path.trim() };
}

export async function handleSessionStart(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  if (!sessionId.trim()) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    const source = parseLocalFolderSource(req.body);
    const result = await provisionSessionSandbox(sessionId.trim(), {
      source
    });
    void autoStartPreview(sessionId.trim()).catch((err) => {
      console.warn(
        `[session ${sessionId}] autoStartPreview failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    res.json({ sessionId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const clientError =
      /Local folder path|source\.path is required/i.test(message);
    res.status(clientError ? N_400 : N_502).json({ error: message });
  }
}

export async function handleSessionStatus(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId query required" });
    return;
  }
  try {
    const status = await getSessionSandboxStatus(sessionId);
    res.json({ sessionId, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(N_500).json({ error: message });
  }
}

export async function handleDownloadArchive(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId query required" });
    return;
  }
  try {
    const { child, filename } = await spawnRepoTarGz(sessionId);
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    child.stdout.pipe(res);
    child.on("error", () => {
      if (!res.headersSent) res.status(N_500).json({ error: "archive failed" });
      else res.end();
    });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => {
      if (code !== 0 && !res.headersSent) {
        res
          .status(N_500)
          .json({ error: stderr.trim() || `tar exited ${code}` });
      }
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handlePromote(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    res.json(await promoteToCanonical(sessionId));
  } catch (err) {
    res
      .status(N_502)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleListApps(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId query required" });
    return;
  }
  try {
    res.json(await listAppStatuses(sessionId));
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleScaffoldApps(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    res.json(await scaffoldForgeConfig(sessionId));
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleWriteAppsConfig(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const config = req.body?.config as ForgeConfig | undefined;
  if (!sessionId || !config || !Array.isArray(config.apps)) {
    res.status(N_400).json({ error: "sessionId and config.apps required" });
    return;
  }
  try {
    await writeForgeConfig(sessionId, config);
    res.json(await listAppStatuses(sessionId));
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleRunApp(req: Request, res: Response): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!sessionId || !name) {
    res.status(N_400).json({ error: "sessionId and name required" });
    return;
  }
  try {
    res.json(await runApp(sessionId, name));
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleStopApp(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!sessionId || !name) {
    res.status(N_400).json({ error: "sessionId and name required" });
    return;
  }
  try {
    await stopApp(sessionId, name);
    res.json({ ok: true });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleAppLogs(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId query param required" });
    return;
  }
  try {
    if (!name) {
      const logs = await appLogsForSession(sessionId);
      res.json({ logs });
      return;
    }
    const logs = await appLogs({ sessionId, name });
    res.type("text/plain; charset=utf-8").send(logs);
  } catch (err) {
    if (!name) {
      res
        .status(N_500)
        .json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
    res
      .status(N_500)
      .type("text/plain; charset=utf-8")
      .send(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSessionPush(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  if (!sessionId.trim() || !content) {
    res.status(N_400).json({ error: "sessionId and content required" });
    return;
  }
  try {
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(N_502).json({ error: message });
  }
}
