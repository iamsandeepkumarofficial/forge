import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useDashboardEmptyState } from "./use-dashboard-empty-state";

vi.mock("../lib/projects-api.js", () => ({
  ConnectProjectError: class extends Error {},
  connectProject: vi.fn(),
  createChat: vi.fn(),
  uploadProject: vi.fn()
}));

vi.mock("../lib/zip-project-files.js", () => ({
  archiveNameForFolder: vi.fn(),
  entriesFromDataTransfer: vi.fn(),
  entriesFromFileList: vi.fn(),
  zipProjectEntries: vi.fn()
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useDashboardEmptyState", () => {
  it("opens github picker from handleBuild", () => {
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
    expect(result.current.showGithubPicker).toBe(true);
    expect(result.current.pendingTitle).toBe("My app");
  });
});
