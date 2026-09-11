import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RunSidebar } from "./run-sidebar";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: vi.fn(),
  scaffoldApps: vi.fn(),
  saveAppsConfig: vi.fn(),
  runApp: vi.fn(),
  stopApp: vi.fn()
}));

import { fetchApps } from "../../lib/tool-runner.js";

describe("RunSidebar", () => {
  beforeEach(() => {
    vi.mocked(fetchApps).mockResolvedValue({ exists: false, apps: [] });
  });

  it("prompts to scaffold when no apps config exists", async () => {
    render(<RunSidebar sessionId="s1" onShowPreview={vi.fn()} />);
    await waitFor(() => {
      expect(fetchApps).toHaveBeenCalledWith("s1");
    });
    expect(screen.getByText(/No \.forge\/launch\.json/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Auto-create" })).toBeTruthy();
  });

  it("shows icon run and stop controls for each app", async () => {
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "web",
          cwd: ".",
          command: "pnpm dev",
          type: "web",
          running: false
        },
        {
          name: "api",
          cwd: ".",
          command: "pnpm start",
          type: "api",
          running: true
        }
      ]
    });
    render(<RunSidebar sessionId="s1" onShowPreview={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run web" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Stop api" })).toBeTruthy();
  });
});
