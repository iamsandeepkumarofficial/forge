import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RightStage } from "./workbench-right-stage";
import type { FileTab } from "./types.js";

vi.mock("./run-panels.js", () => ({
  AppPreviewPane: (props: { sessionId: string }) => (
    <div data-testid="app-preview-pane">{props.sessionId}</div>
  )
}));

vi.mock("./files-panels.js", () => ({
  FileTabPane: (props: { tab: FileTab }) => (
    <div data-testid="file-tab-pane">{props.tab.path}</div>
  )
}));

vi.mock("./bottom-terminal.js", () => ({
  BottomTerminal: (props: { sessionId: string }) => (
    <div data-testid="bottom-terminal">{props.sessionId}</div>
  )
}));

describe("RightStage", () => {
  it("shows Preview and app preview by default", () => {
    render(
      <RightStage
        sessionId="s1"
        docs={[]}
        activeId="preview"
        activeDoc={null}
        onSelect={() => undefined}
        onClose={() => undefined}
        onOpenRun={() => undefined}
        onCommentSent={() => undefined}
      />
    );
    expect(screen.getByRole("button", { name: /Preview/i })).toBeTruthy();
    expect(screen.getByTestId("app-preview-pane").textContent).toBe("s1");
    expect(screen.getByTestId("bottom-terminal").textContent).toBe("s1");
    expect(screen.queryByTestId("file-tab-pane")).toBeNull();
  });

  it("lists file tabs and selects Preview", () => {
    const onSelect = vi.fn();
    const docs: FileTab[] = [
      { id: "file:src/a.ts", kind: "file", path: "src/a.ts" }
    ];
    render(
      <RightStage
        sessionId="s1"
        docs={docs}
        activeId="file:src/a.ts"
        activeDoc={docs[0]!}
        onSelect={onSelect}
        onClose={() => undefined}
        onOpenRun={() => undefined}
        onCommentSent={() => undefined}
      />
    );
    expect(screen.getByText("a.ts")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Preview/i }));
    expect(onSelect).toHaveBeenCalledWith("preview");
  });

  it("closes a doc tab and shows the file pane when active", () => {
    const onClose = vi.fn();
    const docs: FileTab[] = [
      { id: "file:readme.md", kind: "file", path: "readme.md" }
    ];
    render(
      <RightStage
        sessionId="s1"
        docs={docs}
        activeId="file:readme.md"
        activeDoc={docs[0]!}
        onSelect={() => undefined}
        onClose={onClose}
        onOpenRun={() => undefined}
        onCommentSent={() => undefined}
      />
    );
    expect(screen.getByTestId("file-tab-pane").textContent).toBe("readme.md");
    fireEvent.click(screen.getByRole("button", { name: "Close readme.md" }));
    expect(onClose).toHaveBeenCalledWith("file:readme.md");
  });
});
