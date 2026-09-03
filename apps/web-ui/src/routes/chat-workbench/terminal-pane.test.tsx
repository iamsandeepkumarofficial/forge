import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const runTerminalCommand = vi.fn(async () => ({
  success: true,
  output: "file.txt"
}));
const stopTerminalJob = vi.fn(async () => undefined);

vi.mock("../../lib/session-terminal.js", () => ({
  fetchAllTerminalLogs: vi.fn(async () => ({
    jobs: [{ name: "install", running: true, command: "pnpm i" }],
    logs: { install: "added 12 packages" }
  })),
  runTerminalCommand,
  stopTerminalJob
}));

describe("TerminalPane", () => {
  it("renders app logs and background jobs", async () => {
    render(<TerminalPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("hello")).toBeTruthy();
    });
    expect(screen.getByText("world")).toBeTruthy();
    expect(screen.getByRole("button", { name: "web" })).toBeTruthy();
    expect(screen.getByText("added 12 packages")).toBeTruthy();
    expect(screen.getByRole("button", { name: "pnpm i" })).toBeTruthy();
  });

  it("runs a user command into the shell stream", async () => {
    render(<TerminalPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Run command")).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText("Run command"), {
      target: { value: "ls" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => {
      expect(runTerminalCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "s1",
          command: "ls",
          background: false
        })
      );
    });
    expect(await screen.findByText("$ ls")).toBeTruthy();
    expect(screen.getByText("file.txt")).toBeTruthy();
  });

  it("stops a running job", async () => {
    render(<TerminalPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop pnpm i" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop pnpm i" }));
    await waitFor(() => {
      expect(stopTerminalJob).toHaveBeenCalledWith("s1", "install");
    });
  });
});
