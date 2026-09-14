import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
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
import {
  CLEAR_HTML,
  INSPECT_HTML,
  INSPECT_JS,
  inspectAsset
} from "./inspectPage.js";

const N_200 = 200;
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

export type PreviewUpgradeInput = {
  req: IncomingMessage;
  socket: Duplex;
  head: Buffer;
};

type GatewayRuntime = {
  store: RouteStore;
  token: string;
  log: PreviewLogFn;
  proxy: ReturnType<typeof httpProxy.createProxyServer>;
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

export type PreviewGateway = {
  web: (req: Request, res: Response) => void;
  upgrade: (input: PreviewUpgradeInput) => void;
};

function hostnameFromHeaders(headers: IncomingHttpHeaders): string {
  const forwarded = headers["x-forwarded-host"];
  const raw =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? headers.host ?? "";
  return raw.split(":")[0]?.toLowerCase() ?? "";
}

function requestHostname(req: Request): string {
  return hostnameFromHeaders(req.headers);
}

function writeUpgradeError(socket: Duplex, status: number): void {
  const reason = status === N_401 ? "Unauthorized" : "Not Found";
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function resolveProxyTarget(input: { route: PreviewRoute; url: string }): {
  target: string;
  url?: string;
} {
  const pathAndQuery = input.url || "/";
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

function authorizeRoute(input: {
  token: string;
  parsed: NonNullable<ReturnType<typeof parsePreviewHostname>>;
  route: PreviewRoute;
  headers: IncomingHttpHeaders;
}): ReturnType<typeof authorizePreviewAccess> {
  const auth = readRequestAuth(input.headers);
  return authorizePreviewAccess({
    sessionId: input.parsed.sessionId,
    ownerEmail: input.route.ownerEmail,
    requestEmail: auth.email,
    requestToken: auth.token,
    expectedToken: input.token
  });
}

function sendInspectAsset(
  res: Response,
  inspect: "js" | "clear" | "html"
): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(N_200).type(inspect === "js" ? "application/javascript" : "html");
  res.send(
    inspect === "js"
      ? INSPECT_JS
      : inspect === "clear"
        ? CLEAR_HTML
        : INSPECT_HTML
  );
}

function handleGatewayWeb(input: {
  runtime: GatewayRuntime;
  req: Request;
  res: Response;
}): void {
  const { runtime, req, res } = input;
  const hostname = requestHostname(req);
  const parsed = parsePreviewHostname(hostname);
  if (!parsed) {
    runtime.log("preview_deny", {
      status: N_404,
      host: hostname,
      reason: "hostname"
    });
    res.status(N_404).json({ error: "preview_not_found" });
    return;
  }
  const resolved = runtime.store.get(hostname);
  if (!resolved) {
    runtime.log("preview_deny", {
      status: N_404,
      host: hostname,
      reason: "route"
    });
    res.status(N_404).json({ error: "preview_not_found" });
    return;
  }
  const decision = authorizeRoute({
    token: runtime.token,
    parsed,
    route: resolved,
    headers: req.headers
  });
  if (!decision.ok) {
    denyAuth({ res, log: runtime.log, host: hostname, decision });
    return;
  }
  const inspect = inspectAsset(req.url);
  if (inspect) {
    sendInspectAsset(res, inspect);
    return;
  }
  const { target, url } = resolveProxyTarget({
    route: resolved,
    url: req.url || "/"
  });
  if (url != null) req.url = url;
  runtime.proxy.web(req, res, { target }, (err) => {
    runtime.log("preview_proxy_error", { host: hostname, error: String(err) });
    if (!res.headersSent) {
      res.status(N_404).json({ error: "preview_upstream_unavailable" });
    }
  });
}

function handleGatewayUpgrade(input: {
  runtime: GatewayRuntime;
  req: IncomingMessage;
  socket: Duplex;
  head: Buffer;
}): void {
  const { runtime, req, socket, head } = input;
  const hostname = hostnameFromHeaders(req.headers);
  const parsed = parsePreviewHostname(hostname);
  const route = runtime.store.get(hostname);
  if (!parsed || !route) {
    runtime.log("preview_deny", {
      status: N_404,
      host: hostname,
      reason: parsed ? "route" : "hostname"
    });
    writeUpgradeError(socket, N_404);
    return;
  }
  const decision = authorizeRoute({
    token: runtime.token,
    parsed,
    route,
    headers: req.headers
  });
  if (!decision.ok) {
    runtime.log("preview_deny", {
      status: decision.status,
      host: hostname,
      reason: decision.status === N_401 ? "unauthenticated" : "forbidden"
    });
    writeUpgradeError(socket, decision.status);
    return;
  }
  const { target, url } = resolveProxyTarget({
    route,
    url: req.url || "/"
  });
  if (url != null) req.url = url;
  runtime.proxy.ws(req, socket, head, { target }, (err) => {
    runtime.log("preview_proxy_error", { host: hostname, error: String(err) });
    socket.destroy();
  });
}

export function createGateway(options: GatewayOptions): PreviewGateway {
  const runtime: GatewayRuntime = {
    store: options.store,
    token: options.token,
    log: options.log ?? defaultLog,
    proxy:
      options.proxy ??
      httpProxy.createProxyServer({ changeOrigin: true, ws: true })
  };
  return {
    web: (req, res) => handleGatewayWeb({ runtime, req, res }),
    upgrade: (input) => handleGatewayUpgrade({ runtime, ...input })
  };
}
