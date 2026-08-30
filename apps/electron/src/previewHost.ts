import { CANCEL_PICK_SCRIPT, PICK_SCRIPT } from "./pickScript.js";
import {
  startInspectPick,
  wrapDebugger,
  type DebuggerLike
} from "./previewInspect.js";
import {
  IPC_PREVIEW_NAVIGATED,
  ZOOM_BASE,
  type PreviewNavInfo,
  type PreviewPickResult
} from "./types.js";
import {
  isUsableBounds,
  normalizeViewBounds,
  sameLoadedUrl,
  type ViewBounds
} from "./viewBounds.js";

export type HostedWebContents = {
  loadURL: (url: string) => Promise<void>;
  getURL: () => string;
  reload: () => void;
  reloadIgnoringCache: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  setZoomFactor: (factor: number) => void;
  capturePage: (rect?: ViewBounds) => Promise<{ toDataURL: () => string }>;
  executeJavaScript: (code: string) => Promise<unknown>;
  setDevToolsWebContents: (wc: HostedWebContents) => void;
  openDevTools: (options?: { mode: "detach" }) => void;
  on: (event: string, listener: () => void) => void;
  debugger?: DebuggerLike;
  session: {
    clearStorageData: (options: { origin: string }) => Promise<void>;
  };
};

export type HostedView = {
  webContents: HostedWebContents;
  setBounds: (bounds: ViewBounds) => void;
  setVisible: (visible: boolean) => void;
};

export type PreviewWindow = {
  contentView: { addChildView: (view: HostedView) => void };
  webContents: { send: (channel: string, payload: PreviewNavInfo) => void };
};

export type PreviewHostDeps = {
  createPreview: () => HostedView;
  createDevtools: () => HostedView;
};

export class PreviewHost {
  private readonly preview: HostedView;
  private readonly devtools: HostedView;
  private readonly win: PreviewWindow;
  private devtoolsOpened = false;
  private inspectCancel: (() => Promise<void>) | null = null;

  constructor(win: PreviewWindow, deps: PreviewHostDeps) {
    this.win = win;
    this.preview = deps.createPreview();
    this.devtools = deps.createDevtools();
    win.contentView.addChildView(this.preview);
    win.contentView.addChildView(this.devtools);
    this.devtools.setVisible(false);
    this.preview.setVisible(false);
    this.preview.webContents.setDevToolsWebContents(this.devtools.webContents);
    bindNavigation(this.preview.webContents, win);
  }

  setPreviewBounds(rect: ViewBounds): void {
    applyBounds(this.preview, rect);
  }

  setPreviewVisible(visible: boolean): void {
    this.preview.setVisible(visible);
  }

  setDevtoolsBounds(rect: ViewBounds): void {
    applyBounds(this.devtools, rect);
  }

  setDevtoolsVisible(visible: boolean): void {
    if (visible) this.ensureDevtools();
    this.devtools.setVisible(visible);
  }

  async loadURL(url: string): Promise<void> {
    if (sameLoadedUrl(this.preview.webContents.getURL(), url)) return;
    await this.preview.webContents.loadURL(url);
  }

  reload(ignoreCache = false): void {
    if (ignoreCache) {
      this.preview.webContents.reloadIgnoringCache();
      return;
    }
    this.preview.webContents.reload();
  }

  goBack(): void {
    if (this.preview.webContents.canGoBack()) this.preview.webContents.goBack();
  }

  goForward(): void {
    if (this.preview.webContents.canGoForward()) {
      this.preview.webContents.goForward();
    }
  }

  setZoom(percent: number): void {
    this.preview.webContents.setZoomFactor(percent / ZOOM_BASE);
  }

  async capturePage(rect?: ViewBounds): Promise<string> {
    const image = rect
      ? await this.preview.webContents.capturePage(rect)
      : await this.preview.webContents.capturePage();
    return image.toDataURL();
  }

  async clearStorage(origin: string): Promise<void> {
    await this.preview.webContents.session.clearStorageData({ origin });
  }

  async startPick(): Promise<PreviewPickResult | null> {
    const picked = await this.startCdpPick();
    if (picked !== undefined) return picked;
    return this.preview.webContents.executeJavaScript(PICK_SCRIPT) as Promise<
      PreviewPickResult | null
    >;
  }

  async cancelPick(): Promise<void> {
    if (this.inspectCancel) {
      await this.inspectCancel();
      this.inspectCancel = null;
      return;
    }
    await this.preview.webContents.executeJavaScript(CANCEL_PICK_SCRIPT);
  }

  private async startCdpPick(): Promise<PreviewPickResult | null | undefined> {
    const dbg = this.preview.webContents.debugger;
    if (!dbg) return undefined;
    try {
      const session = await startInspectPick(wrapDebugger(dbg));
      this.inspectCancel = session.cancel;
      const pick = await session.promise;
      this.inspectCancel = null;
      return pick;
    } catch {
      this.inspectCancel = null;
      return undefined;
    }
  }

  private ensureDevtools(): void {
    if (this.devtoolsOpened) return;
    void this.cancelPick();
    this.preview.webContents.openDevTools({ mode: "detach" });
    this.devtoolsOpened = true;
  }
}

function applyBounds(view: HostedView, rect: ViewBounds): void {
  const next = normalizeViewBounds(rect);
  view.setBounds(next);
  if (!isUsableBounds(next)) view.setVisible(false);
}

function bindNavigation(wc: HostedWebContents, win: PreviewWindow): void {
  const emit = () => {
    win.webContents.send(IPC_PREVIEW_NAVIGATED, {
      url: wc.getURL(),
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward()
    });
  };
  wc.on("did-navigate", emit);
  wc.on("did-navigate-in-page", emit);
}
