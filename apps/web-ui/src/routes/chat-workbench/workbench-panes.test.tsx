import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MODE_ICON, WorkbenchLeft } from "./workbench-panes";
import type { LeftPaneMode } from "./types";

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

vi.mock("./help-sidebar.js", () => ({
  HelpSidebar: () => <div data-testid="help-sidebar" />
}));

function renderLeft(leftMode: LeftPaneMode) {
  return render(
    <WorkbenchLeft
      sessionId="s1"
      projectId="p1"
      chatId="c1"
      sessionKind="workbench"
      leftMode={leftMode}
      onLeftModeChange={() => undefined}
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
    expect(screen.queryByTestId("help-sidebar")).toBeNull();
  });

  it("shows files in files mode", () => {
    renderLeft("files");
    expect(screen.getByTestId("files-tab")).toBeTruthy();
  });

  it("shows changes, run, and help panes for those modes", () => {
    let view = renderLeft("changes");
    expect(screen.getByTestId("changes-tab")).toBeTruthy();
    view.unmount();
    view = renderLeft("run");
    expect(screen.getByTestId("run-sidebar")).toBeTruthy();
    view.unmount();
    renderLeft("help");
    expect(screen.getByTestId("help-sidebar")).toBeTruthy();
  });
});

describe("MODE_ICON", () => {
  it("exposes icons for every left pane mode", () => {
    expect(Object.keys(MODE_ICON).sort()).toEqual([
      "changes",
      "chat",
      "files",
      "help",
      "run"
    ]);
    expect(MODE_ICON.chat).toBeTruthy();
    expect(MODE_ICON.files).toBeTruthy();
    expect(MODE_ICON.changes).toBeTruthy();
    expect(MODE_ICON.run).toBeTruthy();
    expect(MODE_ICON.help).toBeTruthy();
  });
});
