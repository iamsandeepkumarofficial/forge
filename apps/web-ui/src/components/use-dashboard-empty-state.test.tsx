import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useDashboardEmptyState } from "./use-dashboard-empty-state";

vi.mock("../lib/desktop.js", () => ({
  isDesktop: () => false,
  pickFolder: vi.fn()
}));

vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {},
  connectProject: vi.fn(),
  connectLocalProject: vi.fn()
}));

vi.mock("../lib/workspaces-api.js", () => ({
  createWorkspaceChat: vi.fn()
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useDashboardEmptyState", () => {
  it("sets build hint from handleBuild without github picker", () => {
    const { result } = renderHook(
      () => useDashboardEmptyState({ onConnected: vi.fn() }),
      { wrapper }
    );
    act(() => {
      result.current.setBuildText("My app");
    });
    act(() => {
      result.current.handleBuild();
    });
    expect(result.current.buildHint).toBe(true);
    expect(result.current.pendingTitle).toBe("My app");
  });
});
