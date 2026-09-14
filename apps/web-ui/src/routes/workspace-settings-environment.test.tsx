import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnvironmentPanel } from "./workspace-settings-environment";

const getWorkspaceEnvironment = vi.fn();
const clearWorkspaceEnvironmentLaunch = vi.fn();
const clearWorkspaceEnvironmentDepsCache = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspaceEnvironment: (...args: unknown[]) =>
    getWorkspaceEnvironment(...args),
  clearWorkspaceEnvironmentLaunch: (...args: unknown[]) =>
    clearWorkspaceEnvironmentLaunch(...args),
  clearWorkspaceEnvironmentDepsCache: (...args: unknown[]) =>
    clearWorkspaceEnvironmentDepsCache(...args)
}));

describe("EnvironmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getWorkspaceEnvironment.mockResolvedValue({
      launch: { apps: [] },
      updatedAt: null,
      sourceSessionId: null,
      depsVolumeName: "forge-ws-deps-w1"
    });
    clearWorkspaceEnvironmentLaunch.mockResolvedValue(undefined);
    clearWorkspaceEnvironmentDepsCache.mockResolvedValue(undefined);
  });

  it("loads environment status and shows cache volume", async () => {
    render(<EnvironmentPanel workspaceId="w1" />);
    expect(await screen.findByText("Environment")).toBeTruthy();
    expect(await screen.findByText("Saved launch")).toBeTruthy();
    expect(screen.getByText(/forge-ws-deps-w1/)).toBeTruthy();
    expect(getWorkspaceEnvironment).toHaveBeenCalledWith("w1");
  });

  it("lists saved launch apps", async () => {
    getWorkspaceEnvironment.mockResolvedValue({
      launch: {
        apps: [
          {
            name: "web",
            cwd: "frontend",
            command: "yarn dev",
            type: "web",
            port: 3000,
            repo: "frontend"
          }
        ]
      },
      updatedAt: "2024-06-01T12:00:00.000Z",
      sourceSessionId: "sess-9",
      depsVolumeName: "forge-ws-deps-w1"
    });
    render(<EnvironmentPanel workspaceId="w1" />);
    await waitFor(() => {
      expect(screen.getAllByText("web").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/yarn dev/)).toBeTruthy();
  });

  it("clears saved launch after confirm", async () => {
    getWorkspaceEnvironment
      .mockResolvedValueOnce({
        launch: {
          apps: [
            {
              name: "web",
              cwd: ".",
              command: "pnpm dev",
              type: "web",
              port: 3000,
              repo: "frontend"
            }
          ]
        },
        updatedAt: "2024-06-01T12:00:00.000Z",
        sourceSessionId: null,
        depsVolumeName: "forge-ws-deps-w1"
      })
      .mockResolvedValueOnce({
        launch: { apps: [] },
        updatedAt: null,
        sourceSessionId: null,
        depsVolumeName: "forge-ws-deps-w1"
      });
    render(<EnvironmentPanel workspaceId="w1" />);
    await waitFor(() => {
      expect(screen.getAllByText("web").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear saved launch" }));
    await waitFor(() => {
      expect(clearWorkspaceEnvironmentLaunch).toHaveBeenCalledWith("w1");
    });
    expect(getWorkspaceEnvironment.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("clears package cache after confirm", async () => {
    render(<EnvironmentPanel workspaceId="w1" />);
    expect(await screen.findByText(/forge-ws-deps-w1/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear package cache" })
    );
    await waitFor(() => {
      expect(clearWorkspaceEnvironmentDepsCache).toHaveBeenCalledWith("w1");
    });
  });
});
