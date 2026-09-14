import { useEffect, useState } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import {
  fetchAppRoutes,
  requestSessionAppHttp
} from "../../lib/session-http.js";
import {
  API_METHODS,
  discoverOpenApi,
  formatResponseBody,
  mergeOperations,
  parseHeaderLines,
  type ApiOperation
} from "./api-explorer-model.js";

type SendResult = {
  status: number;
  statusText: string;
  durationMs: number;
  body: string;
};

function useApiOps(options: { sessionId: string; appName?: string }) {
  const { sessionId, appName } = options;
  const [ops, setOps] = useState<ApiOperation[]>([]);
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!appName) {
        setOps([]);
        return;
      }
      setOps([]);
      setScanning(true);
      try {
        const [routes, openApi] = await Promise.all([
          fetchAppRoutes({ sessionId, appName }).catch(() => []),
          discoverOpenApi({
            sessionId,
            appName,
            request: requestSessionAppHttp
          }).catch(() => [])
        ]);
        if (cancelled) return;
        setOps(mergeOperations(openApi, routes));
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appName, sessionId]);
  return { ops, scanning };
}

export function useApiExplorer(options: {
  sessionId: string;
  app: AppStatus | undefined;
  path?: string;
  onPath?: (path: string) => void;
}) {
  const { sessionId, app } = options;
  const [method, setMethod] = useState<(typeof API_METHODS)[number]>("GET");
  const [localPath, setLocalPath] = useState(options.path ?? "/");
  const path = options.path ?? localPath;
  const setPath = options.onPath ?? setLocalPath;
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [boundApp, setBoundApp] = useState(app?.name ?? "");
  const { ops, scanning } = useApiOps({ sessionId, appName: app?.name });

  if (boundApp !== (app?.name ?? "")) {
    setBoundApp(app?.name ?? "");
    setResult(null);
    setError(null);
    setPath("/");
    setMethod("GET");
  }

  if (options.path != null && options.path !== localPath) {
    setLocalPath(options.path);
  }

  const send = async () => {
    if (!app) return;
    setBusy(true);
    setError(null);
    try {
      const headers = parseHeaderLines(headerText);
      if (body.trim() && !headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      const res = await requestSessionAppHttp({
        sessionId,
        appName: app.name,
        method,
        path,
        headers,
        body
      });
      setResult({
        status: res.status,
        statusText: res.statusText,
        durationMs: res.durationMs,
        body: formatResponseBody(res.body)
      });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    method,
    setMethod,
    path,
    setPath,
    headerText,
    setHeaderText,
    body,
    setBody,
    busy,
    error,
    result,
    ops,
    scanning,
    send,
    pick: (op: ApiOperation) => {
      setMethod(op.method as (typeof API_METHODS)[number]);
      setPath(op.path);
    }
  };
}
