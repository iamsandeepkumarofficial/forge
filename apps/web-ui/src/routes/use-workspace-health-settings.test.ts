import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useSettingsTab,
  useWorkspaceHealthSettings
} from "./use-workspace-health-settings";

const getWorkspaceHealth = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspaceHealth: (...args: unknown[]) => getWorkspaceHealth(...args)
}));

describe("useWorkspaceHealthSettings", () => {
  beforeEach(() => {
    getWorkspaceHealth.mockReset();
  });

  it("loads health status and findings", async () => {
    getWorkspaceHealth.mockResolvedValue({
      status: "ok",
      report: {
        findings: [{ severity: "info", code: "x", message: "fine" }]
      }
    });
    const { result } = renderHook(() => useWorkspaceHealthSettings("w1", 1));
    await waitFor(() => expect(result.current.healthStatus).toBe("ok"));
    expect(result.current.healthFindings).toHaveLength(1);
    expect(result.current.setupCtaMode).toBe("analyze");
    expect(result.current.setupDrawerOpen).toBe(false);
  });

  it("uses fix mode when findings are warnings", async () => {
    getWorkspaceHealth.mockResolvedValue({
      status: "degraded",
      report: {
        findings: [{ severity: "warning", code: "y", message: "fix me" }]
      }
    });
    const { result } = renderHook(() => useWorkspaceHealthSettings("w1", 2));
    await waitFor(() => expect(result.current.setupCtaMode).toBe("fix"));
    act(() => {
      result.current.setSetupDrawer("fix");
    });
    expect(result.current.setupDrawerOpen).toBe(true);
  });
});

describe("useSettingsTab", () => {
  it("defaults to overview and updates", () => {
    const { result } = renderHook(() => useSettingsTab());
    expect(result.current.tab).toBe("overview");
    act(() => {
      result.current.setTab("parameters");
    });
    expect(result.current.tab).toBe("parameters");
  });
});
