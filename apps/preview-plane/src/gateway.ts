import type { Request, Response } from "express";
import httpProxy from "http-proxy";
import {
  authorizePreviewAccess,
  readRequestAuth,
  type AuthorizeDecision
} from "./authorize.js";
import { parsePreviewHostname } from "./hostnames.js";
import {
  matchPathRoute,
  type PreviewRoute,
  type RouteStore
} from "./routeStore.js";

const N_401 = 401;
const N_404 = 404;

export type PreviewLogFn = (
  event: string,
  meta: Record<string, unknown>
) => void;

export type GatewayOptions = {
  store: RouteStore;
  token: string;
  log?: PreviewLogFn;
  proxy?: ReturnType<typeof httpProxy.createProxyServer>;
};

function defaultLog(event: string, meta: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ event, ...meta })}\n`);
}

function backendTarget(backendService: string): string {
  if (
    backendService.startsWith("http://") ||
    backendService.startsWith("https://")
  ) {
    return backendService;
  }
  return `http://${backendService}`;
}

function denyAuth(input: {
  res: Response;
  log: PreviewLogFn;
  host: string;
  decision: Extract<AuthorizeDecision, { ok: false }>;
}): void {
  const status = input.decision.status;
  input.log("preview_deny", {
    status,
    host: input.host,
    reason: status === N_401 ? "unauthenticated" : "forbidden"
  });
  input.res.status(status).json({
    error: status === N_401 ? "unauthenticated" : "forbidden"
  });
}

function requestHostname(req: Request): string {
  const forwarded = req.headers["x-forwarded-host"];
  const raw =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded) ??
    req.headers.host ??
    "";
  return raw.split(":")[0]?.toLowerCase() ?? "";
}

function resolveProxyTarget(input: {
  route: PreviewRoute;
  req: Request;
}): { target: string; url?: string } {
  const pathAndQuery = input.req.url || "/";
  const matched = matchPathRoute(input.route.pathRoutes, pathAndQuery);
  if (!matched) {
    return { target: backendTarget(input.route.backendService) };
  }
  let url = pathAndQuery;
  if (matched.stripPrefix && matched.pathPrefix !== "/") {
    const prefix = matched.pathPrefix;
    const pathOnly = pathAndQuery.split("?")[0] || "/";
    const qs = pathAndQuery.includes("?")
      ? pathAndQuery.slice(pathAndQuery.indexOf("?"))
      : "";
    let rest = pathOnly.slice(prefix.length);
    if (!rest.startsWith("/")) rest = `/${rest}`;
    if (rest === "") rest = "/";
    url = `${rest}${qs}`;
  }
  return { target: backendTarget(matched.backendService), url };
}

export function createGateway(
  options: GatewayOptions
): (req: Request, res: Response) => void {
  const proxy =
    options.proxy ?? httpProxy.createProxyServer({ changeOrigin: true });
  const log = options.log ?? defaultLog;

  return function previewGateway(req: Request, res: Response): void {
    const hostname = requestHostname(req);
    const parsed = parsePreviewHostname(hostname);
    if (!parsed) {
      log("preview_deny", {
        status: N_404,
        host: hostname,
        reason: "hostname"
      });
      res.status(N_404).json({ error: "preview_not_found" });
      return;
    }
    const resolved = options.store.get(hostname);
    if (!resolved) {
      log("preview_deny", { status: N_404, host: hostname, reason: "route" });
      res.status(N_404).json({ error: "preview_not_found" });
      return;
    }
    const auth = readRequestAuth(req.headers);
    const decision = authorizePreviewAccess({
      sessionId: parsed.sessionId,
      ownerEmail: resolved.ownerEmail,
      requestEmail: auth.email,
      requestToken: auth.token,
      expectedToken: options.token
    });
    if (!decision.ok) {
      denyAuth({ res, log, host: hostname, decision });
      return;
    }
    const { target, url } = resolveProxyTarget({ route: resolved, req });
    if (url != null) {
      req.url = url;
    }
    proxy.web(req, res, { target }, (err) => {
      log("preview_proxy_error", { host: hostname, error: String(err) });
      if (!res.headersSent) {
        res.status(N_404).json({ error: "preview_upstream_unavailable" });
      }
    });
  };
}
