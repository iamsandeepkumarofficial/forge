import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectToWorkspaceRedirect } from "./project-to-workspace-redirect";

vi.mock("../lib/projects-api.js", () => ({
  fetchPrimaryWorkspace: vi.fn()
}));

import { fetchPrimaryWorkspace } from "../lib/projects-api.js";

describe("ProjectToWorkspaceRedirect", () => {
  beforeEach(() => {
    vi.mocked(fetchPrimaryWorkspace).mockReset();
  });

  it("redirects to the owning workspace chats list", async () => {
    vi.mocked(fetchPrimaryWorkspace).mockResolvedValue({ workspaceId: "w9" });
    render(
      <MemoryRouter initialEntries={["/projects/p1/chats"]}>
        <Routes>
          <Route
            path="/projects/:projectId/chats"
            element={<ProjectToWorkspaceRedirect suffix="chats" />}
          />
          <Route path="/workspaces/:id/chats" element={<div>ws chats</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("ws chats")).toBeTruthy();
    });
    expect(fetchPrimaryWorkspace).toHaveBeenCalledWith("p1");
  });

  it("sends failed lookups home", async () => {
    vi.mocked(fetchPrimaryWorkspace).mockRejectedValue(new Error("missing"));
    render(
      <MemoryRouter initialEntries={["/projects/p-missing/chats"]}>
        <Routes>
          <Route
            path="/projects/:projectId/chats"
            element={<ProjectToWorkspaceRedirect suffix="chats" />}
          />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("home")).toBeTruthy();
    });
  });
});
