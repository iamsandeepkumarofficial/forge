export type ForgeConfig = {
  llm?: {
    openaiApiKey?: string | null;
    anthropicApiKey?: string | null;
    apiKey?: string | null;
    provider?: string | null;
    model?: string | null;
    baseUrl?: string | null;
  };
  desktop?: {
    stopComposeOnQuit?: boolean;
  };
};

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

export type ForgeDesktopPreview = {
  setBounds: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void>;
  setVisible: (visible: boolean) => Promise<void>;
  loadURL: (url: string) => Promise<void>;
  reload: (ignoreCache?: boolean) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  setZoom: (percent: number) => Promise<void>;
  setDevtoolsBounds: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void>;
  setDevtoolsVisible: (visible: boolean) => Promise<void>;
  capturePage: (rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<string>;
  clearStorage: (origin: string) => Promise<void>;
  startPick: () => Promise<PreviewPickResult | null>;
  cancelPick: () => Promise<void>;
  showOverflowMenu: (opts: {
    zoom: number;
    x?: number;
    y?: number;
  }) => Promise<string | null>;
  onNavigated: (fn: (info: PreviewNavInfo) => void) => () => void;
};

export type ForgeDesktopBridge = {
  pickFolder: () => Promise<string | null>;
  getStatus: () => Promise<string>;
  preview?: ForgeDesktopPreview;
};

export const IPC_PICK_FOLDER = "desktop:pickFolder";
export const IPC_GET_STATUS = "desktop:getStatus";
export const IPC_PREVIEW_SET_BOUNDS = "preview:setBounds";
export const IPC_PREVIEW_SET_VISIBLE = "preview:setVisible";
export const IPC_PREVIEW_LOAD = "preview:loadURL";
export const IPC_PREVIEW_RELOAD = "preview:reload";
export const IPC_PREVIEW_GO_BACK = "preview:goBack";
export const IPC_PREVIEW_GO_FORWARD = "preview:goForward";
export const IPC_PREVIEW_SET_ZOOM = "preview:setZoom";
export const IPC_PREVIEW_DT_BOUNDS = "preview:setDevtoolsBounds";
export const IPC_PREVIEW_DT_VISIBLE = "preview:setDevtoolsVisible";
export const IPC_PREVIEW_CAPTURE = "preview:capturePage";
export const IPC_PREVIEW_CLEAR = "preview:clearStorage";
export const IPC_PREVIEW_START_PICK = "preview:startPick";
export const IPC_PREVIEW_CANCEL_PICK = "preview:cancelPick";
export const IPC_PREVIEW_OVERFLOW_MENU = "preview:overflowMenu";
export const IPC_PREVIEW_NAVIGATED = "preview:navigated";
export const PREVIEW_PARTITION = "persist:forge-preview";
export const ZOOM_BASE = 100;

export const WEB_UI_URL = "http://127.0.0.1:5173/";
export const TOOL_PLANE_HEALTH = "http://127.0.0.1:4000/health";

export const WINDOW_WIDTH = 1280;
export const WINDOW_HEIGHT = 800;

export const HEALTH_ATTEMPTS = 60;
export const POSTGRES_ATTEMPTS = 40;
export const POLL_MS = 500;
export const REPO_WALK_LIMIT = 8;
