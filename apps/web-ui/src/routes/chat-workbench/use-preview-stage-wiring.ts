import type { RefObject } from "react";
import { usePreviewHistoryState } from "./use-preview-history-state.js";
import { usePreviewScreenshot } from "./use-preview-screenshot.js";
import { useWebPreviewInspect } from "./use-web-preview-inspect.js";
import { usePreviewElectronPick } from "./use-preview-electron-pick.js";
import { usePreviewCommentState } from "./use-preview-comment-state.js";
import { electronPreview } from "../../lib/desktop.js";

export function usePreviewStageWiring(options: {
  active: import("../../lib/tool-runner.js").AppStatus | undefined;
  surface: "browser" | "api" | "none";
  reloadNonce: number;
  onReload: () => void;
  onCommentSent?: () => void;
  iframeBoxRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
  const comment = usePreviewCommentState(options.onCommentSent);
  const appUrl = options.active?.url ?? "";
  const hist = usePreviewHistoryState({
    active: options.active,
    surface: options.surface,
    appUrl
  });
  const previewApi = electronPreview();
  const shot = usePreviewScreenshot({
    iframeBoxRef: options.iframeBoxRef,
    iframeRef: options.iframeRef,
    previewApi,
    zoom: hist.zoom,
    committedUrl: hist.committedUrl,
    pageUrl: hist.pageUrl
  });
  useWebPreviewInspect({
    commenting: comment.commenting,
    cropping: comment.cropping,
    appUrl,
    address: hist.address,
    reloadNonce: options.reloadNonce,
    cacheBust: hist.cacheBust,
    addressRef: hist.addressRef,
    historyRef: hist.historyRef,
    histIndexRef: hist.histIndexRef,
    iframeRef: options.iframeRef,
    setCommenting: comment.setCommenting,
    setCropping: comment.setCropping,
    setPick: comment.setPick,
    setDraft: comment.setDraft,
    setHistory: hist.setHistory,
    setHistIndex: hist.setHistIndex,
    setAddress: hist.setAddress
  });
  const onPreviewPick = usePreviewElectronPick({
    previewApi,
    setPick: comment.setPick
  });
  const bumpCache = () => {
    hist.setCacheBust((n) => n + 1);
    options.onReload();
  };
  return { comment, hist, shot, previewApi, appUrl, onPreviewPick, bumpCache };
}
