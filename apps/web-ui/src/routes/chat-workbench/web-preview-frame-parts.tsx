import type { RefObject } from "react";
import { iframeZoomStyle } from "./preview-overflow.js";
import { ElectronPreviewHole } from "./electron-preview-hole.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";

export function PreviewIframeFrame(options: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  committedUrl: string;
  reloadNonce: number;
  cacheBust: number;
  iframeSrc: string;
  activeName: string | undefined;
  zoom: number;
}) {
  const {
    iframeRef,
    committedUrl,
    reloadNonce,
    cacheBust,
    iframeSrc,
    activeName,
    zoom
  } = options;
  return (
    <iframe
      ref={iframeRef}
      key={`${committedUrl}#${reloadNonce}#${cacheBust}`}
      src={iframeSrc}
      title={`${activeName ?? "app"} preview`}
      className="block border-0 bg-white"
      style={iframeZoomStyle(zoom)}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}

export function PreviewElectronFrame(options: {
  loadedUrl: string;
  zoom: number;
  reloadNonce: number;
  cacheBust: number;
  commenting: boolean;
  visible: boolean;
  onPreviewNavigated: (info: PreviewNavInfo) => void;
  onPreviewPick: (result: PreviewPickResult) => void;
}) {
  return (
    <ElectronPreviewHole
      url={options.loadedUrl}
      zoom={options.zoom}
      reloadNonce={options.reloadNonce}
      cacheBust={options.cacheBust}
      commenting={options.commenting}
      visible={options.visible}
      onNavigated={options.onPreviewNavigated}
      onPick={options.onPreviewPick}
    />
  );
}
