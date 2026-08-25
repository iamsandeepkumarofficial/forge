import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useWorkbenchSessions } from "./use-workbench-sessions";

vi.mock("../lib/projects-api.js", () => ({
  fetchWorkbenchSessions: vi.fn(async () => [
    { id: "s1", title: "W", lastActivityAt: "2026-01-01T00:00:00.000Z" }
  ]),
  createWorkbenchSession: vi.fn(),
  deleteChat: vi.fn()
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useWorkbenchSessions", () => {
  it("loads sessions for a project", async () => {
    const { result } = renderHook(
      () => useWorkbenchSessions({ projectId: "p1", onClose: vi.fn() }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.sessions).toHaveLength(1);
  });
});
