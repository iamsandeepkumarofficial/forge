import { useEffect, useRef } from "react";
import { electronPreview } from "../../lib/desktop.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";
import { loadElectronPreviewPage } from "./electron-preview-ops.js";

export function useElectronPreviewPage(options: {
  url: string;
  zoom: number;
  reloadNonce: number;
  cacheBust: number;
  commenting: boolean;
  onNavigated: (info: PreviewNavInfo) => void;
  onPick: (pick: PreviewPickResult) => void;
}): void {
  const { url, zoom, reloadNonce, cacheBust, commenting, onNavigated, onPick } =
    options;
  const api = electronPreview();
  const loadedUrl = useRef("");
  useEffect(() => {
    if (!api) return undefined;
    if (!url) {
      loadedUrl.current = "";
      loadElectronPreviewPage({ api, url: "" });
      return undefined;
    }
    const shouldReload = loadedUrl.current === url;
    loadedUrl.current = url;
    loadElectronPreviewPage({
      api,
      url,
      reload: shouldReload,
      ignoreCache: cacheBust > 0
    });
    return undefined;
  }, [api, url, reloadNonce, cacheBust]);
  useEffect(() => {
    if (!api) return undefined;
    return () => {
      loadedUrl.current = "";
      loadElectronPreviewPage({ api, url: "" });
    };
  }, [api]);
  useEffect(() => {
    if (!api) return;
    void api.setZoom(zoom);
  }, [api, zoom]);
  useEffect(() => {
    if (!api) return undefined;
    return api.onNavigated(onNavigated);
  }, [api, onNavigated]);
  useEffect(() => {
    if (!api || !commenting) return undefined;
    let live = true;
    void api.startPick().then((pick) => {
      if (live && pick) onPick(pick);
    });
    return () => {
      live = false;
      void api.cancelPick();
    };
  }, [api, commenting, onPick]);
}
