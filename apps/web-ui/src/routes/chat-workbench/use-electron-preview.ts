import { useEffect, useRef } from "react";
import { electronPreview } from "../../lib/desktop.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";

const BLANK = "about:blank";

async function blankPreview(
  api: NonNullable<ReturnType<typeof electronPreview>>
): Promise<void> {
  await api.setVisible(false);
  await api.loadURL(BLANK);
}

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
    if (!api) return;
    if (!url) {
      loadedUrl.current = "";
      void blankPreview(api);
      return;
    }
    if (loadedUrl.current === url) {
      void api.reload(cacheBust > 0);
      return;
    }
    loadedUrl.current = url;
    void api.loadURL(url);
  }, [api, url, reloadNonce, cacheBust]);
  useEffect(() => {
    if (!api) return undefined;
    return () => {
      loadedUrl.current = "";
      void blankPreview(api);
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
