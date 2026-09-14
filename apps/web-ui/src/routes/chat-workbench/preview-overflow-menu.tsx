import { useRef, useState } from "react";
import { MoreHorizontal, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { electronPreview } from "../../lib/desktop.js";
import {
  openNativePreviewMenu,
  overflowHandlers,
  type PreviewOverflowHandlers
} from "./preview-overflow-actions.js";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  normalizeCrop,
  type ShotRect
} from "./preview-overflow.js";

const MIN_CROP_PX = 8;

export type PreviewOverflowMenuProps = {
  disabled?: boolean;
  zoom: number;
  onTakeScreenshot: () => void;
  onCaptureArea: () => void;
  onHardReload: () => void;
  onCopyUrl: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearHistory: () => void;
  onClearCookies: () => void;
  onClearCache: () => void;
};

export function PreviewOverflowMenu(options: PreviewOverflowMenuProps) {
  const handlers = overflowHandlers(options);
  if (electronPreview()?.showOverflowMenu) {
    return (
      <NativeOverflowButton
        disabled={options.disabled}
        zoom={options.zoom}
        handlers={handlers}
      />
    );
  }
  return <HtmlOverflowMenu options={options} />;
}

function NativeOverflowButton(options: {
  disabled?: boolean;
  zoom: number;
  handlers: PreviewOverflowHandlers;
}) {
  const { disabled, zoom, handlers } = options;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Preview options"
      title="More"
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground disabled:opacity-30"
      onClick={(e) => {
        void openNativePreviewMenu({
          trigger: e.currentTarget,
          zoom,
          handlers
        });
      }}
    >
      <MoreHorizontal className="size-3.5" />
    </button>
  );
}

function HtmlOverflowMenu(options: { options: PreviewOverflowMenuProps }) {
  const {
    disabled,
    zoom,
    onTakeScreenshot,
    onCaptureArea,
    onHardReload,
    onCopyUrl,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onClearHistory,
    onClearCookies,
    onClearCache
  } = options.options;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Preview options"
        title="More"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <DropdownMenuItem onClick={onTakeScreenshot}>
          Take Screenshot
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCaptureArea}>
          Capture Area Screenshot
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onHardReload}>Hard Reload</DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyUrl}>
          Copy Current URL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ZoomRow
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClearHistory}>
          Clear Browsing History
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClearCookies}>
          Clear Cookies
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClearCache}>Clear Cache</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoomRow(options: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}) {
  const { zoom, onZoomIn, onZoomOut, onZoomReset } = options;
  return (
    <div
      className="flex items-center gap-2 px-1.5 py-1.5"
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-sm">Zoom</span>
      <div className="ml-auto flex items-center rounded-md bg-muted">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={onZoomOut}
          className="inline-flex size-7 items-center justify-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-10 text-center text-xs tabular-nums">
          {zoom}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={onZoomIn}
          className="inline-flex size-7 items-center justify-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          +
        </button>
      </div>
      <button
        type="button"
        aria-label="Reset zoom"
        disabled={zoom === ZOOM_DEFAULT}
        onClick={onZoomReset}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}

export function AreaCropOverlay(options: {
  onComplete: (rect: ShotRect | null) => void;
}) {
  const { onComplete } = options;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [now, setNow] = useState<{ x: number; y: number } | null>(null);

  const point = (e: {
    currentTarget: HTMLElement;
    clientX: number;
    clientY: number;
  }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div
      role="presentation"
      aria-label="Select screenshot area"
      className="absolute inset-0 z-10 cursor-crosshair bg-transparent"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = point(e);
        startRef.current = p;
        setStart(p);
        setNow(p);
      }}
      onPointerMove={(e) => {
        if (!startRef.current) return;
        setNow(point(e));
      }}
      onPointerUp={(e) => {
        const a = startRef.current;
        startRef.current = null;
        if (!a) {
          onComplete(null);
          return;
        }
        const rect = normalizeCrop(a, point(e));
        onComplete(
          rect.w >= MIN_CROP_PX && rect.h >= MIN_CROP_PX ? rect : null
        );
      }}
    >
      {start && now ? (
        <div
          className="pointer-events-none absolute border border-primary bg-primary/15"
          style={{
            left: Math.min(start.x, now.x),
            top: Math.min(start.y, now.y),
            width: Math.abs(now.x - start.x),
            height: Math.abs(now.y - start.y)
          }}
        />
      ) : null}
    </div>
  );
}
