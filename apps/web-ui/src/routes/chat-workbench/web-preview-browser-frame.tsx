import type { RefObject } from "react";
import type { PreviewPick } from "./preview-nav.js";
import { AreaCropOverlay } from "./preview-overflow-menu.js";
import type { ShotRect } from "./preview-overflow.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";
import { PreviewPickFreeze } from "./web-preview-pick-freeze.js";
import {
  PreviewElectronFrame,
  PreviewIframeFrame
} from "./web-preview-frame-parts.js";

function CropOverlay(options: {
  cropping: boolean;
  setCropping: (v: boolean) => void;
  takeShot: (rect?: ShotRect) => Promise<void>;
}) {
  if (!options.cropping) return null;
  return (
    <AreaCropOverlay
      onComplete={(rect) => {
        options.setCropping(false);
        if (rect) void options.takeShot(rect);
      }}
    />
  );
}

export function BrowserPreviewFrame(options: {
  iframeBoxRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  pick: PreviewPick | null;
  electron: boolean;
  loadedUrl: string;
  zoom: number;
  reloadNonce: number;
  cacheBust: number;
  commenting: boolean;
  showBrowser: boolean;
  cropping: boolean;
  iframeSrc: string;
  committedUrl: string;
  activeName: string | undefined;
  onPreviewNavigated: (info: PreviewNavInfo) => void;
  onPreviewPick: (result: PreviewPickResult) => void;
  setCropping: (v: boolean) => void;
  takeShot: (rect?: ShotRect) => Promise<void>;
}) {
  const {
    iframeBoxRef,
    iframeRef,
    pick,
    electron,
    loadedUrl,
    zoom,
    reloadNonce,
    cacheBust,
    commenting,
    showBrowser,
    cropping,
    iframeSrc,
    committedUrl,
    activeName,
    onPreviewNavigated,
    onPreviewPick,
    setCropping,
    takeShot
  } = options;
  return (
    <>
      <div
        ref={iframeBoxRef}
        className="relative h-full w-full overflow-hidden"
      >
        <PreviewPickFreeze pick={pick} />
        {electron ? (
          <PreviewElectronFrame
            loadedUrl={loadedUrl}
            zoom={zoom}
            reloadNonce={reloadNonce}
            cacheBust={cacheBust}
            commenting={commenting && !pick}
            visible={showBrowser && !cropping && !pick?.pageShot}
            onPreviewNavigated={onPreviewNavigated}
            onPreviewPick={onPreviewPick}
          />
        ) : (
          <PreviewIframeFrame
            iframeRef={iframeRef}
            committedUrl={committedUrl}
            reloadNonce={reloadNonce}
            cacheBust={cacheBust}
            iframeSrc={iframeSrc}
            activeName={activeName}
            zoom={zoom}
          />
        )}
      </div>
      <CropOverlay
        cropping={cropping}
        setCropping={setCropping}
        takeShot={takeShot}
      />
    </>
  );
}
