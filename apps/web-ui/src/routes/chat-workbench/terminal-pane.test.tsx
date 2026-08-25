import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TerminalPane } from "./terminal-pane";

vi.mock("./use-apps.js", () => ({
  useApps: () => ({
    exists: true,
    apps: [
      {
        name: "web",
        type: "web",
        running: true,
        cwd: ".",
        command: "dev",
        port: 3000
      }
    ],
    error: null,
    refresh: vi.fn()
  })
}));

vi.mock("../../lib/tool-runner.js", () => ({
  fetchAllAppLogs: vi.fn(async () => ({ web: "hello\nworld" }))
}));

describe("TerminalPane", () => {
  it("renders app sessions only, not background jobs", async () => {
    render(<TerminalPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("hello")).toBeTruthy();
    });
    expect(screen.getByText("world")).toBeTruthy();
    expect(screen.getByRole("button", { name: "web" })).toBeTruthy();
    expect(screen.queryByText("added 12 packages")).toBeNull();
    expect(screen.queryByRole("button", { name: "job:install" })).toBeNull();
  });
});
