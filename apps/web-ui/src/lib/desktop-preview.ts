export type PreviewNavInfo = {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type PreviewPickRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PreviewPickResult = {
  url: string;
  selector: string;
  tag: string;
  text: string;
  ariaLabel?: string;
  href?: string;
  nearby?: string;
  rect?: PreviewPickRect;
  viewport?: { w: number; h: number };
};

export type ViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ForgeDesktopPreview = {
  setBounds: (rect: ViewBounds) => Promise<void>;
  setVisible: (visible: boolean) => Promise<void>;
  loadURL: (url: string) => Promise<void>;
  reload: (ignoreCache?: boolean) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  setZoom: (percent: number) => Promise<void>;
  setDevtoolsBounds: (rect: ViewBounds) => Promise<void>;
  setDevtoolsVisible: (visible: boolean) => Promise<void>;
  capturePage: (rect?: ViewBounds) => Promise<string>;
  clearStorage: (origin: string) => Promise<void>;
  startPick: () => Promise<PreviewPickResult | null>;
  cancelPick: () => Promise<void>;
  showOverflowMenu?: (opts: {
    zoom: number;
    x?: number;
    y?: number;
  }) => Promise<string | null>;
  onNavigated: (fn: (info: PreviewNavInfo) => void) => () => void;
};

export function boundsFromRect(rect: DOMRectReadOnly): ViewBounds {
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
}

export function isUsableHole(rect: ViewBounds): boolean {
  return rect.width > 0 && rect.height > 0;
}

export async function noopPreviewOp(): Promise<void> {
  return undefined;
}
