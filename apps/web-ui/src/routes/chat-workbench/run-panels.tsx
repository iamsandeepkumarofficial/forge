import { useState } from "react";
import { RotateCw, ExternalLink } from "lucide-react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { useApps } from "./use-apps.js";

export { useApps } from "./use-apps.js";

export function AppPreviewPane({ sessionId }: { sessionId: string }) {
  const { apps } = useApps(sessionId);
  const webRunning = apps.filter((a) => a.type === "web" && a.running && a.url);
  const webRunningNoUrl = apps.filter(
    (a) => a.type === "web" && a.running && !a.url
  );
  const [selected, setSelected] = useState<string>("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const active = webRunning.find((a) => a.name === selected) ?? webRunning[0];
  if (webRunning.length === 0) {
    if (webRunningNoUrl.length > 0) {
      const ports = webRunningNoUrl
        .map((a) => (a.port != null ? `:${a.port}` : a.name))
        .join(", ");
      return (
        <p className="p-4 text-sm text-muted-foreground">
          App is running inside the sandbox ({ports}) but has no preview URL.
          Forge only publishes ports{" "}
          <span className="font-medium">3000–3009</span>. Set the app port in{" "}
          <span className="font-medium">.forge/launch.json</span> to that range,
          stop the app in the Run tab, then start it again.
        </p>
      );
    }
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No web app is running. Open the <span className="font-medium">Run</span>{" "}
        tab and start one.
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <AppPreviewToolbar
        webRunning={webRunning}
        active={active}
        onSelect={setSelected}
        onReload={() => setReloadNonce((n) => n + 1)}
      />
      <div className="min-h-0 flex-1">
        {active?.url && (
          <iframe
            key={`${active.url}#${reloadNonce}`}
            src={active.url}
            title={`${active.name} preview`}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}

function AppPreviewToolbar(options: {
  webRunning: AppStatus[];
  active: AppStatus | undefined;
  onSelect: (name: string) => void;
  onReload: () => void;
}) {
  const { webRunning, active, onSelect, onReload } = options;
  return (
    <div className="flex items-center gap-2 border-b px-2 py-1.5">
      <select
        value={active?.name}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded border bg-background px-1.5 py-0.5 text-xs"
      >
        {webRunning.map((a) => (
          <option key={a.name} value={a.name}>
            {a.name} :{a.port}
          </option>
        ))}
      </select>
      {active?.url && (
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={active.url}
        >
          {active.url}
        </span>
      )}
      <button
        type="button"
        onClick={onReload}
        disabled={!active?.url}
        title="Refresh preview"
        aria-label="Refresh preview"
        className="rounded border p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <RotateCw className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          active?.url &&
          window.open(active.url, "_blank", "noopener,noreferrer")
        }
        disabled={!active?.url}
        title="Open in new tab"
        aria-label="Open in new tab"
        className="rounded border p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <ExternalLink className="size-3.5" />
      </button>
    </div>
  );
}
