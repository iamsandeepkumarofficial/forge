import { cn } from "@/lib/utils";
import {
  API_METHODS,
  operationKey,
  type ApiOperation
} from "./api-explorer-model.js";

export function EndpointList(options: {
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

export function ApiRequestForm(options: {
  method: (typeof API_METHODS)[number];
  path: string;
  headerText: string;
  body: string;
  busy: boolean;
  onMethod: (method: (typeof API_METHODS)[number]) => void;
  onPath: (path: string) => void;
  onHeaderText: (value: string) => void;
  onBody: (value: string) => void;
  onSend: () => void;
}) {
  const o = options;
  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          o.onSend();
        }}
      >
        <select
          aria-label="HTTP method"
          value={o.method}
          onChange={(e) =>
            o.onMethod(e.target.value as (typeof API_METHODS)[number])
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
          value={o.path}
          onChange={(e) => o.onPath(e.target.value)}
          placeholder="/health"
          className="min-w-[10rem] flex-1 rounded-md border bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={o.busy}
          className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background disabled:opacity-40"
        >
          {o.busy ? "Sending…" : "Send"}
        </button>
      </form>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b px-3 py-2">
        <label className="flex min-h-0 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Headers</span>
          <textarea
            value={o.headerText}
            onChange={(e) => o.onHeaderText(e.target.value)}
            placeholder={"Accept: application/json"}
            className="h-16 resize-none rounded-md border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="flex min-h-0 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Body</span>
          <textarea
            value={o.body}
            onChange={(e) => o.onBody(e.target.value)}
            placeholder='{"name":"ada"}'
            className="h-16 resize-none rounded-md border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
    </>
  );
}

export function ApiResponseView(options: {
  error: string | null;
  result: {
    status: number;
    statusText: string;
    durationMs: number;
    body: string;
  } | null;
}) {
  const { error, result } = options;
  return (
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
  );
}
