import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceIndexRedirect } from "./workspace-index-redirect";

const getWorkspace = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspace: (...args: unknown[]) => getWorkspace(...args)
}));

describe("WorkspaceIndexRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to settings when there are no members", async () => {
    getWorkspace.mockResolvedValue({
      id: "w1",
      members: []
    });
    render(
      <MemoryRouter initialEntries={["/workspaces/w1"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId"
            element={<WorkspaceIndexRedirect />}
          />
          <Route path="/workspaces/:workspaceId/settings" element={<div>Settings</div>} />
          <Route path="/workspaces/:workspaceId/chats" element={<div>Chats</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeTruthy();
    });
  });

  it("redirects to chats when members exist", async () => {
    getWorkspace.mockResolvedValue({
      id: "w1",
      members: [{ id: "m1" }]
    });
    render(
      <MemoryRouter initialEntries={["/workspaces/w1"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId"
            element={<WorkspaceIndexRedirect />}
          />
          <Route path="/workspaces/:workspaceId/settings" element={<div>Settings</div>} />
          <Route path="/workspaces/:workspaceId/chats" element={<div>Chats</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Chats")).toBeTruthy();
    });
  });
});
