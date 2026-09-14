import { useRef } from "react";
import { electronPreview } from "../../lib/desktop.js";
import { noopPreviewOp } from "../../lib/desktop-preview.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";
import { useElectronPreviewPage } from "./use-electron-preview.js";
import { usePreviewOverlayLocked } from "./preview-overlay-lock.js";
import { useViewHole } from "./use-view-hole.js";

export function ElectronPreviewHole(options: {
  url: string;
  zoom: number;
  reloadNonce: number;
  cacheBust: number;
  commenting: boolean;
  visible: boolean;
  onNavigated: (info: PreviewNavInfo) => void;
  onPick: (pick: PreviewPickResult) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = electronPreview();
  const overlayLocked = usePreviewOverlayLocked();
  useViewHole({
    ref,
    active: options.visible && !overlayLocked,
    setBounds: api?.setBounds ?? noopPreviewOp,
    setVisible: api?.setVisible ?? noopPreviewOp
  });
  useElectronPreviewPage({
    url: options.url,
    zoom: options.zoom,
    reloadNonce: options.reloadNonce,
    cacheBust: options.cacheBust,
    commenting: options.commenting,
    onNavigated: options.onNavigated,
    onPick: options.onPick
  });
  return (
    <div
      ref={ref}
      data-testid="electron-preview-hole"
      className="h-full w-full bg-white"
    />
  );
}

export function ElectronDevtoolsHole(options: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const api = electronPreview();
  const overlayLocked = usePreviewOverlayLocked();
  useViewHole({
    ref,
    active: options.active && !overlayLocked,
    setBounds: api?.setDevtoolsBounds ?? noopPreviewOp,
    setVisible: api?.setDevtoolsVisible ?? noopPreviewOp
  });
  return (
    <div
      ref={ref}
      data-testid="electron-devtools-hole"
      className="h-full w-full bg-background"
    />
  );
}
