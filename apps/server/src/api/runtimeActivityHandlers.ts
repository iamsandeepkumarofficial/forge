import type { Request, Response } from "express";
import {
  collectRuntimeActivity,
  stopRuntimeApp,
  stopRuntimeSession
} from "../projects/runtimeActivity.js";

const N_200 = 200;
const N_400 = 400;
const N_500 = 500;

export async function handleGetRuntimeActivity(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const body = await collectRuntimeActivity();
    res.status(N_200).json(body);
  } catch (err) {
    res.status(N_500).json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function handleStopRuntimeSession(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
  if (!sessionId) {
    res.status(N_400).json({ error: "sessionId required" });
    return;
  }
  try {
    await stopRuntimeSession(sessionId);
    res.status(N_200).json({ ok: true, sessionId });
  } catch (err) {
    res.status(N_500).json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function handleStopRuntimeApp(
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
    await stopRuntimeApp({ sessionId, name });
    res.status(N_200).json({ ok: true, sessionId, name });
  } catch (err) {
    res.status(N_500).json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
