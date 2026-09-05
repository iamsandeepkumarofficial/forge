import { PreviewCommentCard } from "./preview-comment-card.js";
import { PreviewOverflowMenu } from "./preview-overflow-menu.js";
import {
  ZOOM_DEFAULT,
  clearPreviewSite,
  copyText,
  stepZoom
} from "./preview-overflow.js";
import { AppPreviewToolbar } from "./app-preview-toolbar.js";
import { WebPreviewContent } from "./web-preview-content.js";
import type { useWebPreviewStage } from "./use-web-preview-stage.js";

type PreviewStage = ReturnType<typeof useWebPreviewStage>;

function PreviewStageHints(options: {
  commenting: boolean;
  cropping: boolean;
  pick: PreviewStage["pick"];
  surface: PreviewStage["surface"];
  chromeNotice: string;
}) {
  const { commenting, cropping, pick, surface, chromeNotice } = options;
  return (
    <>
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
    </>
  );
}

function PreviewStageOverflow(options: { s: PreviewStage }) {
  const s = options.s;
  return (
    <PreviewOverflowMenu
      disabled={s.surface !== "browser" || !s.appUrl}
      zoom={s.zoom}
      onTakeScreenshot={() => void s.takeShot()}
      onCaptureArea={() => {
        if (s.previewApi) {
          void s.takeShot();
          return;
        }
        s.setCommenting(false);
        s.setPick(null);
        s.setDraft("");
        s.setCropping(true);
      }}
      onHardReload={s.bumpCache}
      onCopyUrl={() => void copyText(s.committedUrl || s.pageUrl)}
      onZoomIn={() => s.setZoom((z) => stepZoom(z, 1))}
      onZoomOut={() => s.setZoom((z) => stepZoom(z, -1))}
      onZoomReset={() => s.setZoom(ZOOM_DEFAULT)}
      onClearHistory={() => {
        const current = s.committedUrl || s.pageUrl;
        if (!current) return;
        s.clearHistoryTo(current);
      }}
      onClearCookies={() => {
        const target = s.appUrl || s.committedUrl || s.pageUrl;
        if (s.previewApi && target) {
          void s.previewApi
            .clearStorage(new URL(target).origin)
            .then(s.bumpCache);
          return;
        }
        void clearPreviewSite(target).then(s.bumpCache);
      }}
      onClearCache={s.bumpCache}
    />
  );
}

export function WebPreviewStageBody(options: { s: PreviewStage }) {
  const s = options.s;
  return (
    <>
      <AppPreviewToolbar
        apps={s.apps}
        active={s.active}
        surface={s.surface}
        address={s.address}
        commenting={s.commenting}
        canBack={s.histIndex > 0}
        canForward={s.histIndex >= 0 && s.histIndex < s.history.length - 1}
        onBack={() => s.goHistory(s.histIndex - 1)}
        onForward={() => s.goHistory(s.histIndex + 1)}
        onAddress={s.setAddress}
        onSubmitAddress={s.submitAddress}
        onSelect={s.onSelect}
        onReload={s.onReload}
        onToggleComment={() => {
          s.setCommenting((on) => !on);
          s.setPick(null);
          s.setDraft("");
          s.setCropping(false);
        }}
        overflow={<PreviewStageOverflow s={s} />}
      />
      <PreviewStageHints
        commenting={s.commenting}
        cropping={s.cropping}
        pick={s.pick}
        surface={s.surface}
        chromeNotice={s.chromeNotice}
      />
      {s.pick ? (
        <PreviewCommentCard
          pick={s.pick}
          draft={s.draft}
          onDraft={s.setDraft}
          onCancel={() => {
            s.setPick(null);
            s.setDraft("");
          }}
          onSend={s.sendComment}
          anchorRef={s.iframeBoxRef}
        />
      ) : null}
      <WebPreviewContent
        sessionId={s.sessionId}
        apps={s.apps}
        active={s.active}
        surface={s.surface}
        webRunningNoUrl={s.webRunningNoUrl}
        appUrl={s.appUrl}
        apiPath={s.apiPath}
        setApiPath={s.setApiPath}
        onOpenRun={s.onOpenRun}
        iframeBoxRef={s.iframeBoxRef}
        iframeRef={s.iframeRef}
        pick={s.pick}
        electron={s.electron}
        loadedUrl={s.loadedUrl}
        zoom={s.zoom}
        reloadNonce={s.reloadNonce}
        cacheBust={s.cacheBust}
        commenting={s.commenting}
        showBrowser={s.showBrowser}
        cropping={s.cropping}
        iframeSrc={s.iframeSrc}
        committedUrl={s.committedUrl}
        onPreviewNavigated={s.onPreviewNavigated}
        onPreviewPick={s.onPreviewPick}
        setCropping={s.setCropping}
        takeShot={s.takeShot}
      />
    </>
  );
}
