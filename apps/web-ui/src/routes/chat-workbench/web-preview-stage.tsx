import { useWebPreviewStage } from "./use-web-preview-stage.js";
import { WebPreviewStageBody } from "./web-preview-stage-body.js";
import type { AppStatus } from "../../lib/tool-runner.js";

export function WebPreviewStage(options: {
  sessionId: string;
  apps: AppStatus[];
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  webRunningNoUrl: AppStatus[];
  reloadNonce: number;
  onSelect: (name: string) => void;
  onReload: () => void;
  onOpenRun?: () => void;
  onCommentSent?: () => void;
}) {
  const s = useWebPreviewStage(options);
  return <WebPreviewStageBody s={s} />;
}
