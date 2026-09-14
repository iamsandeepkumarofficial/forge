import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspacesListPage } from "./workspaces-list";

const listWorkspaces = vi.fn();
const createWorkspace = vi.fn();
const deleteWorkspace = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  listWorkspaces: (...args: unknown[]) => listWorkspaces(...args),
  createWorkspace: (...args: unknown[]) => createWorkspace(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspace(...args)
}));

function renderPage(initial = "/workspaces") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/workspaces" element={<WorkspacesListPage />} />
        <Route
          path="/workspaces/:workspaceId"
          element={<div>Workspace home</div>}
        />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkspacesListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkspaces.mockResolvedValue([]);
    createWorkspace.mockResolvedValue({
      id: "w1",
      name: "My workspace",
      routes: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      lastActivityAt: "2024-01-01T00:00:00.000Z"
    });
    deleteWorkspace.mockResolvedValue(undefined);
  });

  it("shows empty state when there are no workspaces", async () => {
    renderPage();
    expect(await screen.findByText("No workspaces yet")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Workspaces" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create workspace" })
    ).toBeTruthy();
  });

  it("lists workspaces and opens one", async () => {
    listWorkspaces.mockResolvedValue([
      {
        id: "w1",
        name: "Demo Forge",
        routes: [{ pathPrefix: "/", target: "frontend" }],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastActivityAt: "2024-01-01T00:00:00.000Z"
      }
    ]);
    renderPage();
    expect(await screen.findByText("Demo Forge")).toBeTruthy();
    expect(screen.getByText(/1 gateway route/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Demo Forge"));
    expect(await screen.findByText("Workspace home")).toBeTruthy();
  });

  it("creates a workspace from the prompt", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("New space");
    renderPage();
    expect(await screen.findByText("No workspaces yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New workspace" }));
    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith("New space");
    });
    expect(await screen.findByText("Workspace home")).toBeTruthy();
  });

  it("deletes a workspace after confirm", async () => {
    listWorkspaces
      .mockResolvedValueOnce([
        {
          id: "w1",
          name: "Demo Forge",
          routes: [],
          createdAt: "2024-01-01T00:00:00.000Z",
          lastActivityAt: "2024-01-01T00:00:00.000Z"
        }
      ])
      .mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    expect(await screen.findByText("Demo Forge")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(deleteWorkspace).toHaveBeenCalledWith("w1");
    });
    expect(await screen.findByText("No workspaces yet")).toBeTruthy();
  });
});
