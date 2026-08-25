import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChatWorkbench } from "./chat-workbench";

vi.mock("../lib/projects-api.js", () => ({
  fetchChat: vi.fn(),
  startSession: vi.fn(async () => ({ sessionId: "s1" }))
}));
vi.mock("../lib/tool-runner.js", () => ({
  downloadRepoArchive: vi.fn(),
  promoteToCanonical: vi.fn()
}));
vi.mock("./chat-workbench/chat-pane.js", () => ({
  ChatPane: () => <div>Chat pane</div>
}));
vi.mock("./chat-workbench/files-panels.js", () => ({
  FilesTab: () => <div>Files tab</div>,
  FileTabPane: () => null,
  ChangesTab: () => null
}));
vi.mock("./chat-workbench/run-panels.js", () => ({
  AppPreviewPane: () => null
}));
vi.mock("./chat-workbench/bottom-terminal.js", () => ({
  BottomTerminal: () => null
}));
vi.mock("./chat-workbench/run-sidebar.js", () => ({
  RunSidebar: () => null
}));

import { fetchChat } from "../lib/projects-api.js";

describe("ChatWorkbench", () => {
  beforeEach(() => {
    vi.mocked(fetchChat).mockResolvedValue({
      id: "c1",
      title: "Workbench chat",
      sessionId: "s1",
      kind: "workbench"
    } as never);
  });

  it("loads chat title and shows workbench panes", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/p1/chats/c1"]}>
        <Routes>
          <Route
            path="/projects/:projectId/chats/:chatId"
            element={<ChatWorkbench />}
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(fetchChat).toHaveBeenCalledWith("p1", "c1");
      expect(screen.getByText("Workbench chat")).toBeTruthy();
    });
    expect(screen.getByText("Chat pane")).toBeTruthy();
  });
});
