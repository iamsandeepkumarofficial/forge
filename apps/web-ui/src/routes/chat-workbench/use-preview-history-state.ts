import { useState } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { ZOOM_DEFAULT } from "./preview-overflow.js";
import {
  usePreviewApiAddressSync,
  usePreviewAppBinding
} from "./use-preview-app-binding.js";
import { clearPreviewHistoryTo } from "./preview-history-nav.js";
import { usePreviewHrefReset } from "./use-preview-href-reset.js";
import { previewHistoryActions } from "./preview-history-actions.js";
import {
  usePreviewHistoryRefs,
  usePreviewNavHandler
} from "./use-preview-history-refs.js";

export function usePreviewHistoryState(options: {
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  appUrl: string;
}) {
  const { active, surface, appUrl } = options;
  const [address, setAddress] = useState(active?.url ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState(-1);
  const [apiPath, setApiPath] = useState("/");
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [cacheBust, setCacheBust] = useState(0);
  const refs = usePreviewHistoryRefs({ history, histIndex, address });
  const previewHref = usePreviewAppBinding({
    active,
    appUrl,
    surface,
    setAddress,
    setHistory,
    setHistIndex,
    setApiPath,
    setZoom,
    setCacheBust
  });
  usePreviewApiAddressSync({ surface, appUrl, active, apiPath, setAddress });
  usePreviewHrefReset({
    previewHref,
    setAddress,
    setHistory,
    setHistIndex,
    setApiPath,
    setZoom,
    setCacheBust
  });
  const actions = previewHistoryActions({
    address,
    appUrl,
    active,
    surface,
    history,
    histIndex,
    setAddress,
    setHistory,
    setHistIndex,
    setApiPath
  });
  const onPreviewNavigated = usePreviewNavHandler({
    histIndexRef: refs.histIndexRef,
    setAddress,
    setHistory,
    setHistIndex
  });
  const pageUrl = address || appUrl;
  const committedUrl =
    histIndex >= 0 && history[histIndex] ? history[histIndex] : pageUrl;
  return {
    address,
    setAddress,
    history,
    setHistory,
    histIndex,
    setHistIndex,
    apiPath,
    setApiPath,
    zoom,
    setZoom,
    cacheBust,
    setCacheBust,
    ...refs,
    pageUrl,
    committedUrl,
    ...actions,
    onPreviewNavigated,
    clearHistoryTo: (current: string) =>
      clearPreviewHistoryTo({ current, setHistory, setHistIndex, setAddress })
  };
}
