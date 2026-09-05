import type { AppStatus } from "../../lib/tool-runner.js";
import { ApiExplorer } from "./api-explorer.js";
import { EmptyPreview, MissingPreviewUrl } from "./web-preview-empty.js";
import { BrowserPreviewFrame } from "./web-preview-browser-frame.js";
import type { WebPreviewContentProps } from "./web-preview-content-props.js";
export type { WebPreviewContentProps } from "./web-preview-content-props.js";

export function WebPreviewEmptyState(options: {
  webRunningNoUrl: AppStatus[];
  onOpenRun?: () => void;
}) {
  return options.webRunningNoUrl.length > 0 ? (
    <MissingPreviewUrl ports={options.webRunningNoUrl} />
  ) : (
    <EmptyPreview onOpenRun={options.onOpenRun} />
  );
}

export function WebPreviewContent(props: WebPreviewContentProps) {
  if (props.apps.length === 0) {
    return (
      <div className="relative min-h-0 flex-1 bg-background">
        <WebPreviewEmptyState
          webRunningNoUrl={props.webRunningNoUrl}
          onOpenRun={props.onOpenRun}
        />
      </div>
    );
  }
  if (props.surface === "browser" && props.appUrl) {
    return (
      <div className="relative min-h-0 flex-1 bg-background">
        <BrowserPreviewFrame
          iframeBoxRef={props.iframeBoxRef}
          iframeRef={props.iframeRef}
          pick={props.pick}
          electron={props.electron}
          loadedUrl={props.loadedUrl}
          zoom={props.zoom}
          reloadNonce={props.reloadNonce}
          cacheBust={props.cacheBust}
          commenting={props.commenting}
          showBrowser={props.showBrowser}
          cropping={props.cropping}
          iframeSrc={props.iframeSrc}
          committedUrl={props.committedUrl}
          activeName={props.active?.name}
          onPreviewNavigated={props.onPreviewNavigated}
          onPreviewPick={props.onPreviewPick}
          setCropping={props.setCropping}
          takeShot={props.takeShot}
        />
      </div>
    );
  }
  if (props.surface === "api") {
    return (
      <div className="relative min-h-0 flex-1 bg-background">
        <ApiExplorer
          sessionId={props.sessionId}
          app={props.active}
          path={props.apiPath}
          onPath={props.setApiPath}
        />
      </div>
    );
  }
  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <MissingPreviewUrl
        ports={props.active ? [props.active] : props.webRunningNoUrl}
      />
    </div>
  );
}
