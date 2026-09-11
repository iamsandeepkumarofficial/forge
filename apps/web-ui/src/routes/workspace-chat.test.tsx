import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceChatWorkbench } from "./workspace-chat";

const fetchWorkspaceChat = vi.fn();
const startSession = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  fetchWorkspaceChat: (...args: unknown[]) => fetchWorkspaceChat(...args)
}));

vi.mock("../lib/projects-api.js", () => ({
  startSession: (...args: unknown[]) => startSession(...args),
  getSessionStatus: vi.fn(async () => ({
    sessionId: "sess-1",
    status: "absent"
  }))
}));

vi.mock("./chat-workbench/workbench-layout.js", () => ({
  Workbench: () => <div data-testid="workbench" />
}));

vi.mock("./chat-workbench/session-header.js", () => ({
  SessionHeader: (props: { title: string }) => (
    <div data-testid="session-header">{props.title}</div>
  )
}));

describe("WorkspaceChatWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWorkspaceChat.mockResolvedValue({
      id: "c1",
      title: "Checkout flow",
      sessionId: "sess-1",
      kind: "workbench"
    });
    startSession.mockResolvedValue(undefined);
  });

  it("boots then shows the workbench", async () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/w1/chats/c1"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/chats/:chatId"
            element={<WorkspaceChatWorkbench />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("session-header").textContent).toBe("Loading…");
    await waitFor(() => {
      expect(screen.getByTestId("session-header").textContent).toBe(
        "Checkout flow"
      );
    });
    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith("sess-1");
    });
    await waitFor(() => {
      expect(screen.getByTestId("workbench")).toBeTruthy();
    });
  });
});
