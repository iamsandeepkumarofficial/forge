import { Router, type Request, type Response } from "express";
import { previewUrl } from "./hostnames.js";
import type { RouteStore } from "./routeStore.js";

const N_400 = 400;
const N_200 = 200;
const N_204 = 204;
const FIRST_APP_PORT = 3000;

type RegisterBody = {
  sessionId?: string;
  port?: number;
  backendService?: string;
  hostname?: string;
  ownerEmail?: string;
  pathRoutes?: Array<{
    pathPrefix?: string;
    backendService?: string;
    stripPrefix?: boolean;
  }>;
};

export type PreviewRoutesOptions = {
  store: RouteStore;
  token: string;
  previewScheme: string;
  previewBaseDomain: string;
};

function defaultHostname(input: {
  sessionId: string;
  port: number;
  base: string;
}): string {
  if (input.port === FIRST_APP_PORT) {
    return `s-${input.sessionId}.${input.base}`;
  }
  return `p${input.port}-s-${input.sessionId}.${input.base}`;
}

function normalizePathRoutes(
  raw: RegisterBody["pathRoutes"]
): Array<{ pathPrefix: string; backendService: string; stripPrefix?: boolean }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    pathPrefix: string;
    backendService: string;
    stripPrefix?: boolean;
  }> = [];
  for (const r of raw) {
    const pathPrefix =
      typeof r?.pathPrefix === "string" ? r.pathPrefix.trim() : "";
    const backendService =
      typeof r?.backendService === "string" ? r.backendService.trim() : "";
    if (!pathPrefix.startsWith("/") || !backendService) continue;
    out.push({
      pathPrefix,
      backendService,
      ...(r.stripPrefix === true ? { stripPrefix: true } : {})
    });
  }
  return out;
}

export function previewInternalRouter(options: PreviewRoutesOptions): Router {
  const router = Router();

  router.post("/preview/register", (req, res) => {
    handleRegister({ req, res, options });
  });
  router.delete("/preview/:sessionId/:port", (req, res) => {
    const removed = options.store.deletePort({
      sessionId: String(req.params.sessionId),
      port: Number(req.params.port)
    });
    res
      .status(removed ? N_204 : N_400)
      .json(removed ? {} : { error: "not_found" });
  });
  router.delete("/preview/:sessionId", (req, res) => {
    options.store.deleteSession(String(req.params.sessionId));
    res.status(N_204).json({});
  });
  return router;
}

function handleRegister(input: {
  req: Request;
  res: Response;
  options: PreviewRoutesOptions;
}): void {
  const body = (input.req.body ?? {}) as RegisterBody;
  if (!body.sessionId || !body.backendService || body.port == null) {
    input.res.status(N_400).json({ error: "invalid_body" });
    return;
  }
  const hostname =
    body.hostname?.trim() ||
    defaultHostname({
      sessionId: body.sessionId,
      port: body.port,
      base: input.options.previewBaseDomain
    });
  const pathRoutes = normalizePathRoutes(body.pathRoutes);
  input.options.store.upsert({
    sessionId: body.sessionId,
    port: body.port,
    hostname,
    backendService: body.backendService,
    ownerEmail: body.ownerEmail,
    ...(pathRoutes.length > 0 ? { pathRoutes } : {})
  });
  input.res.status(N_200).json({
    hostname,
    url: previewUrl(hostname, input.options.previewScheme)
  });
}
