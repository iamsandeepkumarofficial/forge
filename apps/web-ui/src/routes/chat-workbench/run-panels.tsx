import { useState } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { useApps } from "./use-apps.js";
import { WebPreviewStage } from "./web-preview-stage.js";

export { useApps } from "./use-apps.js";

function selectableApps(apps: AppStatus[]): AppStatus[] {
  return apps.filter(
    (a) =>
      a.running &&
      (a.type === "web" || a.type === "api" || a.url != null || a.port != null)
  );
}

function previewSurface(
  app: AppStatus | undefined
): "browser" | "api" | "none" {
  if (!app) return "none";
  if (app.type === "web" && app.url) return "browser";
  if (app.type === "web") return "none";
  return "api";
}

export function AppPreviewPane({
  sessionId,
  onOpenRun,
  onCommentSent
}: {
  sessionId: string;
  onOpenRun?: () => void;
  onCommentSent?: () => void;
}) {
  const { apps } = useApps(sessionId);
  const running = selectableApps(apps);
  const webRunningNoUrl = apps.filter(
    (a) => a.type === "web" && a.running && !a.url
  );
  const [selected, setSelected] = useState<string>("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const preferredWeb = running.find((a) => a.type === "web" && Boolean(a.url));
  const active =
    running.find((a) => a.name === selected) ?? preferredWeb ?? running[0];
  const surface = previewSurface(active);

  return (
    <div className="flex h-full flex-col">
      <WebPreviewStage
        sessionId={sessionId}
        apps={running}
        active={active}
        surface={surface}
        webRunningNoUrl={webRunningNoUrl}
        reloadNonce={reloadNonce}
        onSelect={setSelected}
        onReload={() => setReloadNonce((n) => n + 1)}
        onOpenRun={onOpenRun}
        onCommentSent={onCommentSent}
      />
    </div>
  );
}
