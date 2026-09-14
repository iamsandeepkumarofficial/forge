import type { PreviewNavInfo } from "../../lib/desktop-preview.js";
import { previewFrameUrl } from "./preview-nav.js";

export function previewStageHistoryFields(hist: {
  address: string;
  setAddress: (v: string) => void;
  history: string[];
  histIndex: number;
  apiPath: string;
  setApiPath: (v: string) => void;
  zoom: number;
  setZoom: (v: number | ((z: number) => number)) => void;
  cacheBust: number;
  submitAddress: (typed?: string) => void;
  goHistory: (index: number) => void;
  onPreviewNavigated: (info: PreviewNavInfo) => void;
  clearHistoryTo: (current: string) => void;
  pageUrl: string;
  committedUrl: string;
}) {
  return {
    address: hist.address,
    setAddress: hist.setAddress,
    history: hist.history,
    histIndex: hist.histIndex,
    apiPath: hist.apiPath,
    setApiPath: hist.setApiPath,
    zoom: hist.zoom,
    setZoom: hist.setZoom,
    cacheBust: hist.cacheBust,
    submitAddress: hist.submitAddress,
    goHistory: hist.goHistory,
    onPreviewNavigated: hist.onPreviewNavigated,
    clearHistoryTo: hist.clearHistoryTo,
    pageUrl: hist.pageUrl,
    committedUrl: hist.committedUrl
  };
}

export function previewStageUrls(options: {
  surface: "browser" | "api" | "none";
  appUrl: string;
  loadedUrl: string;
}) {
  const iframeSrc =
    options.surface === "browser" && options.loadedUrl
      ? previewFrameUrl(options.loadedUrl)
      : options.loadedUrl;
  return {
    loadedUrl: options.loadedUrl,
    iframeSrc,
    showBrowser: options.surface === "browser" && Boolean(options.appUrl)
  };
}
