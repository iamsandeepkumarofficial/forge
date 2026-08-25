import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectShell } from "./project-shell";

vi.mock("../lib/projects-api.js", () => ({
  fetchProject: vi.fn()
}));

import { fetchProject } from "../lib/projects-api.js";

describe("ProjectShell", () => {
  beforeEach(() => {
    vi.mocked(fetchProject).mockResolvedValue({
      id: "p1",
      name: "Forge App",
      source: "github",
      status: "available"
    });
  });

  it("loads workspace name and renders chats nav", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/p1/chats"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectShell />}>
            <Route path="chats" element={<div>Chats body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Forge App")).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Chats" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Board" })).toBeNull();
    expect(screen.getByText("Chats body")).toBeTruthy();
    expect(screen.getByRole("button", { name: /New chat/i })).toBeTruthy();
  });
});
