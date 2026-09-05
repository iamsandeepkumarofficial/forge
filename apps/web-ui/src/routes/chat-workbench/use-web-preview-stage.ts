import { useRef } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { isElectronPreview } from "../../lib/desktop.js";
import { previewLoadedUrl } from "./use-preview-screenshot.js";
import {
  previewStageHistoryFields,
  previewStageUrls
} from "./preview-stage-fields.js";
import { usePreviewStageWiring } from "./use-preview-stage-wiring.js";

export function useWebPreviewStage(options: {
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
  const iframeBoxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wired = usePreviewStageWiring({
    active: options.active,
    surface: options.surface,
    reloadNonce: options.reloadNonce,
    onReload: options.onReload,
    onCommentSent: options.onCommentSent,
    iframeBoxRef,
    iframeRef
  });
  const loadedUrl = previewLoadedUrl(
    wired.hist.committedUrl,
    wired.hist.cacheBust
  );
  return {
    sessionId: options.sessionId,
    apps: options.apps,
    active: options.active,
    surface: options.surface,
    webRunningNoUrl: options.webRunningNoUrl,
    reloadNonce: options.reloadNonce,
    onSelect: options.onSelect,
    onReload: options.onReload,
    onOpenRun: options.onOpenRun,
    ...previewStageHistoryFields(wired.hist),
    ...wired.comment,
    ...previewStageUrls({
      surface: options.surface,
      appUrl: wired.appUrl,
      loadedUrl
    }),
    chromeNotice: wired.shot.chromeNotice,
    iframeBoxRef,
    iframeRef,
    electron: isElectronPreview(),
    previewApi: wired.previewApi,
    appUrl: wired.appUrl,
    onPreviewPick: wired.onPreviewPick,
    bumpCache: wired.bumpCache,
    takeShot: wired.shot.takeShot
  };
}
