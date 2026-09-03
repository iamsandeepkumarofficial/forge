import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/home";
import { SettingsPage } from "./routes/settings";

vi.mock("./lib/tool-runner.js", () => ({
  runnerUrl: () => "http://127.0.0.1:4000"
}));
vi.mock("./lib/projects-api.js", () => ({
  deleteProject: vi.fn()
}));
vi.mock("./lib/workspaces-api.js", () => ({
  listWorkspaces: vi.fn().mockResolvedValue([]),
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn()
}));
vi.mock("./components/dashboard-empty-state.js", () => ({
  DashboardEmptyState: () => <div>Empty state</div>
}));
vi.mock("./components/project-card.js", () => ({
  ProjectCard: () => null
}));
vi.mock("./components/connect-project-dialog.js", () => ({
  ConnectProjectDialog: () => null
}));
vi.mock("./routes/chat-workbench.js", () => ({
  ChatWorkbench: () => <div>Workbench route</div>
}));
vi.mock("./components/project-shell.js", () => ({
  ProjectShell: () => <div>Shell route</div>
}));
vi.mock("./routes/chats.js", () => ({
  ChatsPage: () => <div>Chats route</div>
}));

describe("App routes", () => {
  it("Home route mounts workspaces landing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => []
      })
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Empty state")).toBeTruthy();
  });

  it("Settings route mounts", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });
});

describe("App module", () => {
  it("exports a default App component", async () => {
    const mod = await import("./App");
    expect(typeof mod.default).toBe("function");
  });
});
