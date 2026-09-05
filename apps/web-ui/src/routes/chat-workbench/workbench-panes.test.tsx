import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MODE_ICON, WorkbenchLeft } from "./workbench-panes";

vi.mock("./chat-pane.js", () => ({
  ChatPane: () => <div data-testid="chat-pane" />
}));

vi.mock("./files-panels.js", () => ({
  FilesTab: () => <div data-testid="files-tab" />,
  ChangesTab: () => <div data-testid="changes-tab" />
}));

vi.mock("./run-sidebar.js", () => ({
  RunSidebar: () => <div data-testid="run-sidebar" />
}));

function renderLeft(leftMode: "chat" | "files" | "changes" | "run") {
  return render(
    <WorkbenchLeft
      sessionId="s1"
      projectId="p1"
      chatId="c1"
      sessionKind="workbench"
      leftMode={leftMode}
      onOpenFile={() => undefined}
      onOpenDiff={() => undefined}
      onShowPreview={() => undefined}
      onTurnStatus={() => undefined}
    />
  );
}

describe("WorkbenchLeft", () => {
  it("shows chat in chat mode and hides other panes", () => {
    renderLeft("chat");
    expect(screen.getByTestId("chat-pane")).toBeTruthy();
    expect(screen.queryByTestId("files-tab")).toBeNull();
    expect(screen.queryByTestId("changes-tab")).toBeNull();
    expect(screen.queryByTestId("run-sidebar")).toBeNull();
  });

  it("shows files in files mode", () => {
    renderLeft("files");
    expect(screen.getByTestId("files-tab")).toBeTruthy();
  });

  it("shows changes and run panes for those modes", () => {
    const { unmount } = renderLeft("changes");
    expect(screen.getByTestId("changes-tab")).toBeTruthy();
    unmount();
    renderLeft("run");
    expect(screen.getByTestId("run-sidebar")).toBeTruthy();
  });
});

describe("MODE_ICON", () => {
  it("exposes icons for every left pane mode", () => {
    expect(Object.keys(MODE_ICON).sort()).toEqual([
      "changes",
      "chat",
      "files",
      "run"
    ]);
    expect(MODE_ICON.chat).toBeTruthy();
    expect(MODE_ICON.files).toBeTruthy();
    expect(MODE_ICON.changes).toBeTruthy();
    expect(MODE_ICON.run).toBeTruthy();
  });
});
