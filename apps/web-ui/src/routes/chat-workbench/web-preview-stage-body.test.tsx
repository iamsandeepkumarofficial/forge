import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebPreviewStageBody } from "./web-preview-stage-body";
import type { AppStatus } from "../../lib/tool-runner.js";

vi.mock("./app-preview-toolbar.js", () => ({
  AppPreviewToolbar: (props: {
    address: string;
    surface: string;
    commenting: boolean;
    overflow?: React.ReactNode;
  }) => (
    <div data-testid="preview-toolbar">
      {props.surface}:{props.address}:{String(props.commenting)}
      {props.overflow}
    </div>
  )
}));

vi.mock("./web-preview-content.js", () => ({
  WebPreviewContent: (props: { sessionId: string; surface: string }) => (
    <div data-testid="preview-content">
      {props.sessionId}:{props.surface}
    </div>
  )
}));

vi.mock("./preview-comment-card.js", () => ({
  PreviewCommentCard: (props: { draft: string }) => (
    <div data-testid="comment-card">{props.draft}</div>
  )
}));

vi.mock("./preview-overflow-menu.js", () => ({
  PreviewOverflowMenu: () => <div data-testid="overflow-menu" />
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

function stageStub(overrides: Record<string, unknown> = {}) {
  const active = app();
  return {
    sessionId: "s1",
    apps: [active],
    active,
    surface: "browser" as const,
    webRunningNoUrl: [] as AppStatus[],
    address: "/home",
    commenting: false,
    cropping: false,
    pick: null,
    draft: "",
    chromeNotice: "",
    histIndex: 0,
    history: ["http://127.0.0.1:3000/"],
    goHistory: vi.fn(),
    setAddress: vi.fn(),
    submitAddress: vi.fn(),
    onSelect: vi.fn(),
    onReload: vi.fn(),
    setCommenting: vi.fn(),
    setPick: vi.fn(),
    setDraft: vi.fn(),
    setCropping: vi.fn(),
    sendComment: vi.fn(),
    iframeBoxRef: createRef<HTMLDivElement | null>(),
    iframeRef: createRef<HTMLIFrameElement | null>(),
    appUrl: "http://127.0.0.1:3000/",
    apiPath: "/",
    setApiPath: vi.fn(),
    onOpenRun: vi.fn(),
    electron: false,
    loadedUrl: "http://127.0.0.1:3000/",
    zoom: 100,
    reloadNonce: 0,
    cacheBust: 0,
    showBrowser: true,
    iframeSrc: "http://127.0.0.1:3000/",
    committedUrl: "http://127.0.0.1:3000/",
    pageUrl: "http://127.0.0.1:3000/",
    onPreviewNavigated: vi.fn(),
    onPreviewPick: vi.fn(),
    takeShot: vi.fn(async () => undefined),
    bumpCache: vi.fn(),
    setZoom: vi.fn(),
    clearHistoryTo: vi.fn(),
    previewApi: null,
    ...overrides
  };
}

describe("WebPreviewStageBody", () => {
  it("renders toolbar and content from the stage stub", () => {
    render(<WebPreviewStageBody s={stageStub() as never} />);
    expect(screen.getByTestId("preview-toolbar").textContent).toBe(
      "browser:/home:false"
    );
    expect(screen.getByTestId("preview-content").textContent).toBe(
      "s1:browser"
    );
    expect(screen.getByTestId("overflow-menu")).toBeTruthy();
  });

  it("shows the commenting hint when commenting without a pick", () => {
    render(
      <WebPreviewStageBody
        s={stageStub({ commenting: true, pick: null }) as never}
      />
    );
    expect(
      screen.getByText(/Hover to highlight an element, then click it/i)
    ).toBeTruthy();
  });

  it("shows chrome notice and crop hint when cropping", () => {
    render(
      <WebPreviewStageBody
        s={
          stageStub({
            cropping: true,
            chromeNotice: "Hard reload applied"
          }) as never
        }
      />
    );
    expect(screen.getByText(/Drag to select an area/i)).toBeTruthy();
    expect(screen.getByText("Hard reload applied")).toBeTruthy();
  });

  it("renders the comment card when a pick is present", () => {
    render(
      <WebPreviewStageBody
        s={
          stageStub({
            pick: { tag: "button", path: "body > button" },
            draft: "Looks off"
          }) as never
        }
      />
    );
    expect(screen.getByTestId("comment-card").textContent).toBe("Looks off");
    expect(screen.queryByText(/Hover to highlight an element/i)).toBeNull();
  });
});
