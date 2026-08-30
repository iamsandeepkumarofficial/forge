import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  MousePointer2,
  RotateCw,
  SquareTerminal
} from "lucide-react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { cn } from "@/lib/utils";
import { useApps } from "./use-apps.js";
import { postPreviewChatMessage } from "./preview-comment-bus.js";
import { ApiExplorer } from "./api-explorer.js";
import { apiBaseUrl, previewPortLabel } from "./api-explorer-model.js";
import {
  formatPreviewComment,
  pathFromPreviewUrl,
  previewFrameUrl,
  pushPreviewHistory,
  resolvePreviewNavigation,
  samePreviewUrl,
  stripCacheBust,
  type PreviewPick
} from "./preview-nav.js";
import {
  AreaCropOverlay,
  PreviewOverflowMenu
} from "./preview-overflow-menu.js";
import {
  ZOOM_DEFAULT,
  cacheBustUrl,
  captureInspectFrameShot,
  capturePreviewShot,
  clearPreviewSite,
  copyPngDataUrl,
  copyText,
  iframeZoomStyle,
  mapCropToPage,
  shotRectToBounds,
  stepZoom,
  type ShotRect
} from "./preview-overflow.js";
import {
  capturePickShot,
  pickFromElectron,
  pickShotRect,
  previewPickFields
} from "./preview-pick.js";
import { requestDevtoolsToggle } from "./terminal-toggle.js";
import { electronPreview, isElectronPreview } from "../../lib/desktop.js";
import type { PreviewNavInfo, PreviewPickResult } from "../../lib/desktop-preview.js";
import { ElectronPreviewHole } from "./electron-preview-hole.js";
import {
  PREVIEW_FREEZE_FALLBACK,
  PreviewCommentCard,
  PreviewFreezeLayer
} from "./preview-comment-card.js";

export { useApps } from "./use-apps.js";

function selectableApps(apps: AppStatus[]): AppStatus[] {
  return apps.filter(
    (a) =>
      a.running &&
      (a.type === "web" || a.type === "api" || a.url != null || a.port != null)
  );
}

function previewSurface(app: AppStatus | undefined): "browser" | "api" | "none" {
  if (!app) return "none";
  if (app.type === "web" && app.url) return "browser";
  if (app.type === "web") return "none";
  return "api";
}

export function AppPreviewPane({
  sessionId,
  onOpenRun,
  onCommentSent
}: {
  sessionId: string;
  onOpenRun?: () => void;
  onCommentSent?: () => void;
}) {
  const { apps } = useApps(sessionId);
  const running = selectableApps(apps);
  const webRunningNoUrl = apps.filter(
    (a) => a.type === "web" && a.running && !a.url
  );
  const [selected, setSelected] = useState<string>("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const preferredWeb = running.find((a) => a.type === "web" && Boolean(a.url));
  const active =
    running.find((a) => a.name === selected) ?? preferredWeb ?? running[0];
  const surface = previewSurface(active);

  return (
    <div className="flex h-full flex-col">
      <WebPreviewStage
        sessionId={sessionId}
        apps={running}
        active={active}
        surface={surface}
        webRunningNoUrl={webRunningNoUrl}
        reloadNonce={reloadNonce}
        onSelect={setSelected}
        onReload={() => setReloadNonce((n) => n + 1)}
        onOpenRun={onOpenRun}
        onCommentSent={onCommentSent}
      />
    </div>
  );
}

function WebPreviewStage(options: {
  sessionId: string;
  apps: AppStatus[];
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  webRunningNoUrl: AppStatus[];
  reloadNonce: number;
  onSelect: (name: string) => void;
  onReload: () => void;
  onOpenRun?: () => void;
  onCommentSent?: () => void;
}) {
  const {
    sessionId,
    apps,
    active,
    surface,
    webRunningNoUrl,
    reloadNonce,
    onSelect,
    onReload,
    onOpenRun,
    onCommentSent
  } = options;
  const [address, setAddress] = useState(active?.url ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState(-1);
  const [apiPath, setApiPath] = useState("/");
  const [commenting, setCommenting] = useState(false);
  const [pick, setPick] = useState<PreviewPick | null>(null);
  const [draft, setDraft] = useState("");
  const [boundApp, setBoundApp] = useState(active?.name ?? "");
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [cacheBust, setCacheBust] = useState(0);
  const [cropping, setCropping] = useState(false);
  const [chromeNotice, setChromeNotice] = useState("");
  const iframeBoxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const electron = isElectronPreview();
  const previewApi = electronPreview();
  const historyRef = useRef(history);
  const histIndexRef = useRef(histIndex);
  const addressRef = useRef(address);
  historyRef.current = history;
  histIndexRef.current = histIndex;
  addressRef.current = address;
  const appUrl = active?.url ?? "";
  const fallbackUrl =
    appUrl || (surface === "api" ? apiBaseUrl(active ?? {}) : "");
  const previewHref = fallbackUrl
    ? fallbackUrl.startsWith("http")
      ? fallbackUrl
      : `http://${fallbackUrl}/`
    : "";

  if (boundApp !== (active?.name ?? "")) {
    setBoundApp(active?.name ?? "");
    if (previewHref) {
      setAddress(previewHref);
      setHistory([previewHref]);
      setHistIndex(0);
      setApiPath("/");
    }
  }

  useEffect(() => {
    if (!previewHref) return;
    setHistory((stack) => {
      const sameApp = stack.some((url) => {
        try {
          return new URL(url).origin === new URL(previewHref).origin;
        } catch {
          return false;
        }
      });
      if (sameApp && stack.length > 0) return stack;
      setAddress(previewHref);
      setHistIndex(0);
      setApiPath("/");
      setZoom(ZOOM_DEFAULT);
      setCacheBust(0);
      return [previewHref];
    });
  }, [previewHref]);

  useEffect(() => {
    if (surface !== "api") return;
    const raw = appUrl || apiBaseUrl(active ?? {});
    if (!raw) return;
    const base = raw.startsWith("http") ? raw : `http://${raw}/`;
    try {
      setAddress(new URL(apiPath || "/", base).href);
    } catch {
      setAddress(apiPath);
    }
  }, [apiPath, surface, appUrl, active?.url, active?.hostPort, active?.port]);

  useEffect(() => {
    if (!commenting && !cropping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cropping) setCropping(false);
      if (commenting) {
        setCommenting(false);
        setPick(null);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commenting, cropping]);

  useEffect(() => {
    if (!appUrl) return;
    const origin = new URL(appUrl).origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as {
        type?: string;
        url?: string;
        rect?: unknown;
        viewport?: { w: number; h: number };
      } & Partial<PreviewPick>;
      if (data?.type === "forge-inspect-nav" && typeof data.url === "string") {
        const next = stripCacheBust(data.url);
        if (samePreviewUrl(addressRef.current, next)) return;
        const moved = pushPreviewHistory(historyRef.current, {
          index: histIndexRef.current,
          next
        });
        setHistory(moved.stack);
        setHistIndex(moved.index);
        setAddress(next);
        return;
      }
      if (!commenting || data?.type !== "forge-inspect-pick") return;
      if (typeof data.url !== "string" || typeof data.tag !== "string") return;
      const next = previewPickFields({
        url: data.url,
        tag: data.tag,
        selector: typeof data.selector === "string" ? data.selector : "",
        text: typeof data.text === "string" ? data.text : "",
        ariaLabel: typeof data.ariaLabel === "string" ? data.ariaLabel : "",
        href: typeof data.href === "string" ? data.href : "",
        nearby: typeof data.nearby === "string" ? data.nearby : "",
        rect: data.rect,
        viewport: data.viewport
      });
      setPick(next);
      const rect = pickShotRect({
        rect: data.rect,
        viewport: data.viewport
      });
      const iframe = iframeRef.current;
      if (!iframe || !rect) return;
      void capturePickShot({
        rect,
        capture: (area) =>
          captureInspectFrameShot({
            iframe,
            origin,
            rect: area
          })
      }).then((shot) => {
        if (shot) setPick((cur) => (cur ? { ...cur, shot } : cur));
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [commenting, appUrl]);

  useEffect(() => {
    if (!appUrl) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        { type: "forge-inspect-set", on: commenting },
        new URL(appUrl).origin
      );
    } catch {
      void 0;
    }
  }, [commenting, appUrl, address, reloadNonce, cacheBust]);

  const submitAddress = (typed = address) => {
    const base = appUrl || apiBaseUrl(active ?? {});
    if (!base) return;
    const next = resolvePreviewNavigation(
      base.startsWith("http") ? base : `http://${base}/`,
      typed
    );
    if (!next) {
      if (appUrl) setAddress(appUrl);
      return;
    }
    setAddress(next);
    const moved = pushPreviewHistory(history, { index: histIndex, next });
    setHistory(moved.stack);
    setHistIndex(moved.index);
    if (surface === "api") {
      setApiPath(pathFromPreviewUrl(next));
    }
  };

  const goHistory = (index: number) => {
    const url = history[index];
    if (!url) return;
    setHistIndex(index);
    setAddress(url);
    if (surface === "api") setApiPath(pathFromPreviewUrl(url));
  };

  const sendComment = () => {
    if (!pick) return;
    postPreviewChatMessage(formatPreviewComment(pick, draft));
    setDraft("");
    setPick(null);
    setCommenting(false);
    onCommentSent?.();
  };

  const pageUrl = address || appUrl;
  const committedUrl =
    histIndex >= 0 && history[histIndex] ? history[histIndex] : pageUrl;
  const loadedUrl =
    cacheBust > 0 ? cacheBustUrl(committedUrl, cacheBust) : committedUrl;
  const iframeSrc =
    surface === "browser" && loadedUrl ? previewFrameUrl(loadedUrl) : loadedUrl;
  const showBrowser = surface === "browser" && Boolean(appUrl);
  const onPreviewNavigated = useCallback((info: PreviewNavInfo) => {
    if (!info.url || info.url === "about:blank") return;
    const next = stripCacheBust(info.url);
    setAddress(next);
    setHistory((stack) => {
      const idx = histIndexRef.current;
      if (stack[idx] && samePreviewUrl(stack[idx], next)) return stack;
      const moved = pushPreviewHistory(stack, { index: idx, next });
      setHistIndex(moved.index);
      return moved.stack;
    });
  }, []);
  const onPreviewPick = useCallback((result: PreviewPickResult) => {
    const mapped = pickFromElectron(result);
    setPick(mapped.pick);
    if (!previewApi) return;
    void previewApi.capturePage().then(
      (img) => {
        setPick((cur) => (cur ? { ...cur, pageShot: img } : cur));
      },
      () => {
        setPick((cur) =>
          cur ? { ...cur, pageShot: PREVIEW_FREEZE_FALLBACK } : cur
        );
      }
    );
    if (!mapped.rect) return;
    void capturePickShot({
      rect: mapped.rect,
      capture: (area) => previewApi.capturePage(shotRectToBounds(area))
    }).then((shot) => {
      if (shot) setPick((cur) => (cur ? { ...cur, shot } : cur));
    });
  }, [previewApi]);
  const bumpCache = () => {
    setCacheBust((n) => n + 1);
    onReload();
  };

  const takeShot = async (rect?: ShotRect) => {
    const box = iframeBoxRef.current;
    const scale = zoom / 100;
    const width = Math.round((box?.clientWidth ?? 1200) / scale);
    const height = Math.round((box?.clientHeight ?? 800) / scale);
    const mapped = rect ? mapCropToPage(rect, zoom) : undefined;
    try {
      let dataUrl: string;
      if (previewApi) {
        dataUrl = await previewApi.capturePage(
          mapped ? shotRectToBounds(mapped) : undefined
        );
        await copyPngDataUrl(dataUrl);
        setChromeNotice("Screenshot copied");
        window.setTimeout(() => setChromeNotice(""), 4000);
        return;
      }
      const live = iframeRef.current;
      if (live?.contentWindow) {
        dataUrl = await captureInspectFrameShot({
          iframe: live,
          origin: new URL(committedUrl || pageUrl).origin,
          rect: mapped
        });
      } else {
        dataUrl = await capturePreviewShot({
          pageUrl: committedUrl || pageUrl,
          width,
          height,
          rect: mapped
        });
      }
      await copyPngDataUrl(dataUrl);
      setChromeNotice("Screenshot copied");
      window.setTimeout(() => setChromeNotice(""), 4000);
    } catch {
      setChromeNotice(
        "Couldn't capture this page. Open it in a new tab to screenshot."
      );
      window.setTimeout(() => setChromeNotice(""), 4000);
    }
  };

  return (
    <>
      <AppPreviewToolbar
        apps={apps}
        active={active}
        surface={surface}
        address={address}
        commenting={commenting}
        canBack={histIndex > 0}
        canForward={histIndex >= 0 && histIndex < history.length - 1}
        onBack={() => goHistory(histIndex - 1)}
        onForward={() => goHistory(histIndex + 1)}
        onAddress={setAddress}
        onSubmitAddress={submitAddress}
        onSelect={onSelect}
        onReload={onReload}
        onToggleComment={() => {
          setCommenting((on) => !on);
          setPick(null);
          setDraft("");
          setCropping(false);
        }}
        overflow={
          <PreviewOverflowMenu
            disabled={surface !== "browser" || !appUrl}
            zoom={zoom}
            onTakeScreenshot={() => void takeShot()}
            onCaptureArea={() => {
              if (previewApi) {
                void takeShot();
                return;
              }
              setCommenting(false);
              setPick(null);
              setDraft("");
              setCropping(true);
            }}
            onHardReload={bumpCache}
            onCopyUrl={() => void copyText(committedUrl || pageUrl)}
            onZoomIn={() => setZoom((z) => stepZoom(z, 1))}
            onZoomOut={() => setZoom((z) => stepZoom(z, -1))}
            onZoomReset={() => setZoom(ZOOM_DEFAULT)}
            onClearHistory={() => {
              const current = committedUrl || pageUrl;
              if (!current) return;
              setHistory([current]);
              setHistIndex(0);
              setAddress(current);
            }}
            onClearCookies={() => {
              const target = appUrl || committedUrl || pageUrl;
              if (previewApi && target) {
                void previewApi
                  .clearStorage(new URL(target).origin)
                  .then(bumpCache);
                return;
              }
              void clearPreviewSite(target).then(bumpCache);
            }}
            onClearCache={bumpCache}
          />
        }
      />
      {commenting && !pick && surface === "browser" ? (
        <p className="border-b bg-primary/5 px-3 py-1 text-[11px] text-muted-foreground">
          Hover to highlight an element, then click it. Esc cancels.
        </p>
      ) : null}
      {cropping && surface === "browser" ? (
        <p className="border-b bg-primary/5 px-3 py-1 text-[11px] text-muted-foreground">
          Drag to select an area. Esc cancels.
        </p>
      ) : null}
      {chromeNotice ? (
        <p className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          {chromeNotice}
        </p>
      ) : null}
      {pick ? (
        <PreviewCommentCard
          pick={pick}
          draft={draft}
          onDraft={setDraft}
          onCancel={() => {
            setPick(null);
            setDraft("");
          }}
          onSend={sendComment}
          anchorRef={iframeBoxRef}
        />
      ) : null}
      <div className="relative min-h-0 flex-1 bg-background">
        {apps.length === 0 ? (
          webRunningNoUrl.length > 0 ? (
            <MissingPreviewUrl ports={webRunningNoUrl} />
          ) : (
            <EmptyPreview onOpenRun={onOpenRun} />
          )
        ) : surface === "browser" && appUrl ? (
          <>
            <div ref={iframeBoxRef} className="relative h-full w-full overflow-hidden">
              {pick?.pageShot ? (
                <PreviewFreezeLayer
                  src={pick.pageShot}
                  anchor={pick.anchor}
                  viewport={pick.viewport}
                />
              ) : null}
              {electron ? (
                <ElectronPreviewHole
                  url={loadedUrl}
                  zoom={zoom}
                  reloadNonce={reloadNonce}
                  cacheBust={cacheBust}
                  commenting={commenting && !pick}
                  visible={showBrowser && !cropping && !pick?.pageShot}
                  onNavigated={onPreviewNavigated}
                  onPick={onPreviewPick}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  key={`${committedUrl}#${reloadNonce}#${cacheBust}`}
                  src={iframeSrc}
                  title={`${active?.name ?? "app"} preview`}
                  className="block border-0 bg-white"
                  style={iframeZoomStyle(zoom)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
            {cropping ? (
              <AreaCropOverlay
                onComplete={(rect) => {
                  setCropping(false);
                  if (rect) void takeShot(rect);
                }}
              />
            ) : null}
          </>
        ) : surface === "api" ? (
          <ApiExplorer
            sessionId={sessionId}
            app={active}
            path={apiPath}
            onPath={setApiPath}
          />
        ) : (
          <MissingPreviewUrl ports={active ? [active] : webRunningNoUrl} />
        )}
      </div>
    </>
  );
}

function EmptyPreview({ onOpenRun }: { onOpenRun?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium">No preview yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start a web app on ports 3000–3009 and it will show up here.
      </p>
      {onOpenRun ? (
        <button
          type="button"
          onClick={onOpenRun}
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
        >
          Start an app
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open <span className="font-medium">Run</span> and start one.
        </p>
      )}
    </div>
  );
}

function MissingPreviewUrl({ ports }: { ports: AppStatus[] }) {
  const label = ports
    .map((a) => (a.port != null ? `:${a.port}` : a.name))
    .join(", ");
  return (
    <p className="p-4 text-sm text-muted-foreground">
      App is running inside the sandbox ({label}) but has no preview URL. Forge
      only publishes ports <span className="font-medium">3000–3009</span>. Set
      the app port in <span className="font-medium">.forge/launch.json</span> to
      that range, stop the app in Run, then start it again.
    </p>
  );
}

function chromeBtn(extra?: string): string {
  return cn(
    "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30",
    extra
  );
}

function AppPreviewToolbar(options: {
  apps: AppStatus[];
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  address: string;
  commenting: boolean;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onAddress: (v: string) => void;
  onSubmitAddress: (typed?: string) => void;
  onSelect: (name: string) => void;
  onReload: () => void;
  onToggleComment: () => void;
  overflow?: ReactNode;
}) {
  const {
    apps,
    active,
    surface,
    address,
    commenting,
    canBack,
    canForward,
    onBack,
    onForward,
    onAddress,
    onSubmitAddress,
    onSelect,
    onReload,
    onToggleComment,
    overflow
  } = options;
  const urlLive = surface === "browser" || surface === "api";
  return (
    <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1">
      <button
        type="button"
        aria-label="Back"
        title="Back"
        disabled={!canBack}
        onClick={onBack}
        className={chromeBtn()}
      >
        <ArrowLeft className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Forward"
        title="Forward"
        disabled={!canForward}
        onClick={onForward}
        className={chromeBtn()}
      >
        <ArrowRight className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Refresh preview"
        title="Refresh"
        disabled={surface !== "browser"}
        onClick={onReload}
        className={chromeBtn()}
      >
        <RotateCw className="size-3.5" />
      </button>
      <span className="mx-1 h-4 w-px shrink-0 bg-border" />
      {apps.length > 0 ? (
        <select
          value={active?.name}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Preview port"
          className="mr-1 rounded-md border-0 bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground outline-none hover:bg-muted"
        >
          {apps.map((a) => (
            <option key={a.name} value={a.name} title={a.name}>
              {previewPortLabel(a)}
            </option>
          ))}
        </select>
      ) : null}
      <form
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-background px-2.5 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          const typed = new FormData(e.currentTarget).get("preview-url");
          onSubmitAddress(typeof typed === "string" ? typed : address);
        }}
      >
        {surface === "api" ? (
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            API
          </span>
        ) : (
          <Lock className="size-3 shrink-0 text-muted-foreground" />
        )}
        <input
          name="preview-url"
          aria-label="Preview URL"
          value={address}
          disabled={!urlLive}
          onChange={(e) => onAddress(e.target.value)}
          placeholder={urlLive ? "Path or URL" : "No app running"}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none disabled:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!urlLive}
          className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background disabled:opacity-40"
        >
          Go
        </button>
      </form>
      <button
        type="button"
        onClick={onToggleComment}
        disabled={surface !== "browser"}
        title="Comment on an element"
        aria-label="Comment on an element"
        aria-pressed={commenting}
        className={chromeBtn(
          commenting ? "border border-primary text-primary" : undefined
        )}
      >
        <MousePointer2 className="size-3.5" />
      </button>
      <button
        type="button"
        title="DevTools"
        aria-label="DevTools"
        disabled={surface !== "browser"}
        onClick={() => requestDevtoolsToggle()}
        className={chromeBtn()}
      >
        <SquareTerminal className="size-3.5" />
      </button>
      {overflow}
    </div>
  );
}
