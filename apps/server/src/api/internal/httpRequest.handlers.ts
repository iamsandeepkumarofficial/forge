import type { Request, Response } from "express";
import { listAppStatuses } from "../../projects/appRunner.js";
import {
  appRequestBaseUrl,
  joinAppRequestUrl,
  methodAllowsBody,
  parseHttpMethod,
  sanitizeRequestHeaders
} from "./httpRequest.js";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;
const N_15_000 = 15_000;
const N_200_000 = 200_000;

export async function handleAppHttpRequest(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const appName =
    typeof req.body?.appName === "string" ? req.body.appName.trim() : "";
  const method = parseHttpMethod(req.body?.method) ?? "GET";
  const path = typeof req.body?.path === "string" ? req.body.path : "/";
  const body = typeof req.body?.body === "string" ? req.body.body : "";
  if (!sessionId || !appName) {
    res.status(N_400).json({ error: "sessionId and appName required" });
    return;
  }
  try {
    const { apps } = await listAppStatuses(sessionId);
    const app = apps.find((a) => a.name === appName && a.running);
    if (!app) {
      res.status(N_404).json({ error: "Running app not found" });
      return;
    }
    const base = appRequestBaseUrl(app);
    if (!base) {
      res.status(N_400).json({ error: "App has no reachable URL" });
      return;
    }
    const target = joinAppRequestUrl(base, path);
    if (!target) {
      res.status(N_400).json({ error: "Path must stay on the app origin" });
      return;
    }
    const started = Date.now();
    const upstream = await fetch(target, {
      method,
      headers: sanitizeRequestHeaders(req.body?.headers),
      body: methodAllowsBody(method) && body ? body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(N_15_000)
    });
    const text = await upstream.text();
    const clipped =
      text.length > N_200_000
        ? `${text.slice(0, N_200_000)}\n\n… (truncated)`
        : text;
    res.json({
      url: target,
      status: upstream.status,
      statusText: upstream.statusText,
      headers: Object.fromEntries(upstream.headers.entries()),
      body: clipped,
      durationMs: Date.now() - started
    });
  } catch (err) {
    res
      .status(N_500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}
