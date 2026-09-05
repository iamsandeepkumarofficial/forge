import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceChatsView } from "./workspace-chats-view";

const page = {
  workspace: { id: "w1", name: "Checkout", members: [{ projectId: "p1" }] },
  chats: [
    {
      id: "c1",
      title: "Feature work",
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ],
  filtered: [
    {
      id: "c1",
      title: "Feature work",
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ],
  error: null as string | null,
  busy: false,
  hasMembers: true,
  query: "",
  setQuery: vi.fn(),
  deletingId: null,
  mostRecent: null,
  onNewChat: vi.fn(),
  onDelete: vi.fn(),
  openChat: vi.fn()
};

vi.mock("./use-workspace-chats-page.js", () => ({
  useWorkspaceChatsPage: () => page
}));

describe("WorkspaceChatsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    page.error = null;
    page.hasMembers = true;
    page.filtered = page.chats;
    page.workspace = {
      id: "w1",
      name: "Checkout",
      members: [{ projectId: "p1" }]
    };
  });

  it("lists chats and creates a new one", () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/w1/chats"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/chats"
            element={<WorkspaceChatsView />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Checkout")).toBeTruthy();
    expect(screen.getByText("Feature work")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New workspace chat" }));
    expect(page.onNewChat).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Feature work"));
    expect(page.openChat).toHaveBeenCalledWith("c1");
  });

  it("disables new chat when there are no members", () => {
    page.hasMembers = false;
    render(
      <MemoryRouter initialEntries={["/workspaces/w1/chats"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/chats"
            element={<WorkspaceChatsView />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(
      (
        screen.getByRole("button", {
          name: "New workspace chat"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
