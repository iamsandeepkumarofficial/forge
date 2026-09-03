import type { Request, Response } from "express";
import { listAppStatuses } from "../../projects/appRunner.js";
import { resolveLaunchAppDir } from "../../projects/launchCwd.js";
import { dockerExec, resolveSandbox } from "../../projects/sandboxExec.js";
import { parseRouteScanLines, ROUTE_SCAN_SCRIPT } from "./appRoutes.js";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

export async function handleAppRoutes(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  const appName =
    typeof req.query.appName === "string" ? req.query.appName.trim() : "";
  if (!sessionId || !appName) {
    res.status(N_400).json({ error: "sessionId and appName required" });
    return;
  }
  try {
    const { apps } = await listAppStatuses(sessionId);
    const app = apps.find((a) => a.name === appName);
    if (!app) {
      res.status(N_404).json({ error: "App not found" });
      return;
    }
    const sandbox = await resolveSandbox(sessionId);
    const resolved = await resolveLaunchAppDir({
      containerName: sandbox.containerName,
      workingDir: sandbox.workingDir,
      repoDir: sandbox.repoDir,
      cwd: app.cwd
    });
    const scan = await dockerExec({
      container: sandbox.containerName,
      argv: ["sh", "-lc", ROUTE_SCAN_SCRIPT],
      cwd: resolved.appDir
    });
    res.json({ routes: parseRouteScanLines(`${scan.stdout}\n${scan.stderr}`) });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
