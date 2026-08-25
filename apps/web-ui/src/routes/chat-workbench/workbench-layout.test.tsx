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

import { Workbench } from "./workbench-layout";

describe("Workbench", () => {
  it("renders chat and preview panes", () => {
    render(
      <Workbench
        sessionId="s1"
        projectId="p1"
        chatId="c1"
        sessionKind="ticket"
      />
    );
    expect(screen.getByText("chat-pane")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
    expect(screen.getByText("terminal")).toBeTruthy();
    expect(screen.queryByText("Logs")).toBeNull();
    const rightPane = screen.getByRole("button", { name: "Preview" })
      .parentElement?.parentElement;
    expect(rightPane?.textContent).toContain("terminal");
    expect(rightPane?.textContent).not.toContain("chat-pane");
  });
});
