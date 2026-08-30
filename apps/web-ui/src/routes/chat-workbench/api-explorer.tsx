import { useEffect, useState } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import {
  fetchAppRoutes,
  requestSessionAppHttp
} from "../../lib/session-http.js";
import { cn } from "@/lib/utils";
import {
  API_METHODS,
  OPENAPI_SPEC_PATHS,
  apiBaseUrl,
  formatResponseBody,
  mergeOperations,
  operationKey,
  operationsFromOpenApi,
  parseHeaderLines,
  tryParseJsonBody,
  type ApiOperation
} from "./api-explorer-model.js";

export function ApiExplorer(options: {
  sessionId: string;
  app: AppStatus | undefined;
  path?: string;
  onPath?: (path: string) => void;
}) {
  const { sessionId, app } = options;
  const base = app ? apiBaseUrl(app) : "";
  const [method, setMethod] = useState<(typeof API_METHODS)[number]>("GET");
  const [localPath, setLocalPath] = useState(options.path ?? "/");
  const path = options.path ?? localPath;
  const setPath = options.onPath ?? setLocalPath;
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    body: string;
  } | null>(null);
  const [ops, setOps] = useState<ApiOperation[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
    setPath("/");
    setMethod("GET");
  }, [app?.name]);

  useEffect(() => {
    if (options.path != null) setLocalPath(options.path);
  }, [options.path]);

  useEffect(() => {
    if (!app?.name) {
      setOps([]);
      return;
    }
    let cancelled = false;
    setOps([]);
    setScanning(true);
    const scan = fetchAppRoutes({ sessionId, appName: app.name })
      .then((found) => {
        if (!cancelled) setOps((cur) => mergeOperations(cur, found));
      })
      .catch(() => undefined);
    const spec = discoverOpenApi({ sessionId, appName: app.name }).then(
      (found) => {
        if (!cancelled && found.length > 0) {
          setOps((cur) => mergeOperations(found, cur));
        }
      }
    );
    void Promise.all([scan, spec]).finally(() => {
      if (!cancelled) setScanning(false);
    });
    return () => {
      cancelled = true;
    };
  }, [app?.name, sessionId]);

  if (!app) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No API selected.</p>
    );
  }
  if (!base) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {app.name} is running but has no reachable URL. Forge only publishes
        ports 3000–3009.
      </p>
    );
  }

  const send = async () => {
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

  const pick = (op: ApiOperation) => {
    setMethod(op.method as (typeof API_METHODS)[number]);
    setPath(op.path);
  };

  return (
    <div className="flex h-full min-h-0">
      <EndpointList
        ops={ops}
        scanning={scanning}
        activeKey={operationKey({ method, path })}
        onPick={pick}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <form
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <select
            aria-label="HTTP method"
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as (typeof API_METHODS)[number])
            }
            className="rounded-md border bg-background px-1.5 py-1 font-mono text-xs"
          >
            {API_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            aria-label="Request path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/health"
            className="min-w-[10rem] flex-1 rounded-md border bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-b px-3 py-2">
          <label className="flex min-h-0 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Headers</span>
            <textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder={"Accept: application/json"}
              className="h-16 resize-none rounded-md border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex min-h-0 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"name":"ada"}'
              className="h-16 resize-none rounded-md border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : result ? (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {result.status} {result.statusText}
                </span>
                {result.durationMs ? ` · ${result.durationMs}ms` : ""}
              </p>
              <pre className="whitespace-pre-wrap font-mono text-[11px]">
                {result.body || "(empty)"}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick an endpoint or send a custom request.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointList(options: {
  ops: ApiOperation[];
  scanning: boolean;
  activeKey: string;
  onPick: (op: ApiOperation) => void;
}) {
  const { ops, scanning, activeKey, onPick } = options;
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r bg-muted/30">
      <p className="border-b px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Endpoints
      </p>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        {scanning && ops.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">
            Scanning routes…
          </p>
        ) : ops.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">
            No routes found in the app. Type a path and Send.
          </p>
        ) : (
          ops.map((op) => {
            const key = operationKey(op);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(op)}
                className={cn(
                  "mb-0.5 flex w-full flex-col items-start rounded-md px-2 py-1 text-left hover:bg-background",
                  activeKey === key && "bg-background"
                )}
              >
                <span className="font-mono text-[10px] font-medium text-muted-foreground">
                  {op.method}
                </span>
                <span className="w-full truncate font-mono text-[11px]">
                  {op.path}
                </span>
                {op.summary ? (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {op.summary}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

const OPENAPI_TIMEOUT_MS = 4000;

async function discoverOpenApi(options: {
  sessionId: string;
  appName: string;
}): Promise<ApiOperation[]> {
  const groups = await Promise.all(
    OPENAPI_SPEC_PATHS.map(async (specPath) => {
      try {
        const res = await requestSessionAppHttp({
          sessionId: options.sessionId,
          appName: options.appName,
          method: "GET",
          path: specPath,
          signal: AbortSignal.timeout(OPENAPI_TIMEOUT_MS)
        });
        if (res.status < 200 || res.status >= 300) return [];
        return operationsFromOpenApi(tryParseJsonBody(res.body));
      } catch {
        return [];
      }
    })
  );
  return mergeOperations(...groups);
}
