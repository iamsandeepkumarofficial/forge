import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WebPreviewContent, WebPreviewEmptyState } from "./web-preview-content";
import type { AppStatus } from "../../lib/tool-runner.js";
import type { WebPreviewContentProps } from "./web-preview-content-props.js";

vi.mock("./web-preview-browser-frame.js", () => ({
  BrowserPreviewFrame: (props: {
    committedUrl: string;
    activeName?: string;
  }) => (
    <div data-testid="browser-frame">
      {props.activeName}:{props.committedUrl}
    </div>
  )
}));

vi.mock("./api-explorer.js", () => ({
  ApiExplorer: (props: {
    sessionId: string;
    path: string;
    app?: { name: string };
  }) => (
    <div data-testid="api-explorer">
      {props.sessionId}:{props.app?.name}:{props.path}
    </div>
  )
}));

function app(overrides: Partial<AppStatus> = {}): AppStatus {
  return {
    name: "web",
    cwd: ".",
    command: "npm start",
    type: "web",
    port: 3000,
    running: true,
    url: "http://127.0.0.1:3000",
    ...overrides
  };
}

function baseProps(
  overrides: Partial<WebPreviewContentProps> = {}
): WebPreviewContentProps {
  return {
    sessionId: "s1",
    apps: [],
    active: undefined,
    surface: "none",
    webRunningNoUrl: [],
    appUrl: "",
    apiPath: "/",
    setApiPath: vi.fn(),
    iframeBoxRef: createRef<HTMLDivElement | null>(),
    iframeRef: createRef<HTMLIFrameElement | null>(),
    pick: null,
    electron: false,
    loadedUrl: "",
    zoom: 100,
    reloadNonce: 0,
    cacheBust: 0,
    commenting: false,
    showBrowser: true,
    cropping: false,
    iframeSrc: "",
    committedUrl: "",
    onPreviewNavigated: vi.fn(),
    onPreviewPick: vi.fn(),
    setCropping: vi.fn(),
    takeShot: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("WebPreviewEmptyState", () => {
  it("shows empty preview and Start an app when nothing is running", () => {
    const onOpenRun = vi.fn();
    render(<WebPreviewEmptyState webRunningNoUrl={[]} onOpenRun={onOpenRun} />);
    expect(screen.getByText("No preview yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start an app" }));
    expect(onOpenRun).toHaveBeenCalledTimes(1);
  });

  it("shows missing URL copy when apps run without a preview URL", () => {
    render(
      <WebPreviewEmptyState
        webRunningNoUrl={[app({ url: undefined, port: 3010 })]}
      />
    );
    expect(screen.getByText(/no preview URL/i)).toBeTruthy();
    expect(screen.getByText(/:3010/)).toBeTruthy();
  });
});

describe("WebPreviewContent", () => {
  it("renders browser frame when surface is browser with a URL", () => {
    const active = app();
    render(
      <WebPreviewContent
        {...baseProps({
          apps: [active],
          active,
          surface: "browser",
          appUrl: active.url!,
          committedUrl: active.url!
        })}
      />
    );
    expect(screen.getByTestId("browser-frame").textContent).toBe(
      "web:http://127.0.0.1:3000"
    );
  });

  it("renders API explorer or missing URL for the other surfaces", () => {
    const api = app({ name: "api", type: "api" });
    const { unmount } = render(
      <WebPreviewContent
        {...baseProps({
          apps: [api],
          active: api,
          surface: "api",
          apiPath: "/v1/health"
        })}
      />
    );
    expect(screen.getByTestId("api-explorer").textContent).toBe(
      "s1:api:/v1/health"
    );
    unmount();
    const active = app({ url: undefined, port: 3005 });
    render(
      <WebPreviewContent
        {...baseProps({
          apps: [active],
          active,
          surface: "browser",
          appUrl: ""
        })}
      />
    );
    expect(screen.getByText(/no preview URL/i)).toBeTruthy();
    expect(screen.getByText(/:3005/)).toBeTruthy();
  });
});
