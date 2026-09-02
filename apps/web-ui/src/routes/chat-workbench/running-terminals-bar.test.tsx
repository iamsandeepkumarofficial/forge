import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RunningTerminalsBar } from "./running-terminals-bar";
import {
  resetTrackedTerminalsForTests,
  trackApp,
  trackBackgroundJob
} from "./tracked-terminals";
import { resetTerminalSessionRegistryForTests } from "../../lib/terminal-session-registry";

const requestOpenTerminalTab = vi.fn();
const stopApp = vi.fn(async () => ({ ok: true }));
const stopTerminalJob = vi.fn(async () => undefined);

vi.mock("./terminal-toggle.js", () => ({
  requestOpenTerminalTab: (...args: unknown[]) =>
    requestOpenTerminalTab(...args)
}));

vi.mock("../../lib/tool-runner.js", () => ({
  stopApp: (...args: unknown[]) => stopApp(...args)
}));

vi.mock("../../lib/session-terminal.js", () => ({
  stopTerminalJob: (...args: unknown[]) => stopTerminalJob(...args)
}));

vi.mock("../../lib/terminal-session-client.js", () => ({
  streamIdForJobTab: (name: string) => `job:${name}`,
  streamIdForAppTab: (tabId: string) => tabId,
  TerminalSessionClient: class {
    connect() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    subscribe() {
      return () => undefined;
    }
  }
}));

describe("RunningTerminalsBar", () => {
  beforeEach(() => {
    requestOpenTerminalTab.mockClear();
    stopApp.mockClear();
    stopTerminalJob.mockClear();
    resetTrackedTerminalsForTests();
    resetTerminalSessionRegistryForTests();
  });

  it("shows collapsed count and opens a tab when expanded", async () => {
    trackApp("s1", "web");
    trackBackgroundJob("s1", "install");
    render(<RunningTerminalsBar sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("2 terminals running")).toBeTruthy();
    });
    expect(screen.queryByText("web")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /2 terminals running/i }));
    expect(screen.getByText("web")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Open web in terminal" })
    );
    expect(requestOpenTerminalTab).toHaveBeenCalledWith({
      id: "app:web",
      kind: "app"
    });
  });

  it("stops an app from the list", async () => {
    trackApp("s1", "web");
    render(<RunningTerminalsBar sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("1 terminal running")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /1 terminal running/i }));
    fireEvent.click(screen.getByRole("button", { name: "Stop web" }));
    await waitFor(() => {
      expect(stopApp).toHaveBeenCalledWith("s1", "web");
    });
  });
});
