import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./chat-pane.js", () => ({ ChatPane: () => <div>chat-pane</div> }));
vi.mock("./files-panels.js", () => ({
  FilesTab: () => <div>files</div>,
  ChangesTab: () => <div>changes</div>,
  FileTabPane: () => <div>file-tab</div>
}));
vi.mock("./run-panels.js", () => ({
  AppPreviewPane: () => <div>preview</div>
}));
vi.mock("./bottom-terminal.js", () => ({
  BottomTerminal: () => <div>terminal</div>
}));
vi.mock("./run-sidebar.js", () => ({
  RunSidebar: () => <div>run</div>
}));
vi.mock("./use-apps.js", () => ({
  useApps: () => ({ apps: [], exists: true, error: null, refresh: vi.fn() })
}));

import { Workbench } from "./workbench-layout";

describe("Workbench", () => {
  it("shows chat on the left and preview as a right-pane tab", () => {
    render(
      <Workbench
        sessionId="s1"
        projectId="p1"
        chatId="c1"
        sessionKind="ticket"
        leftMode="chat"
        onLeftModeChange={vi.fn()}
      />
    );
    expect(screen.getByText("chat-pane")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
    expect(screen.getByText("terminal")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.queryByText("files")).toBeNull();
  });

  it("switches the left pane to files without covering preview", () => {
    render(
      <Workbench
        sessionId="s1"
        projectId="p1"
        chatId="c1"
        sessionKind="ticket"
        leftMode="files"
        onLeftModeChange={vi.fn()}
      />
    );
    expect(screen.getByText("files")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Files" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close panel" })).toBeNull();
  });
});
