import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useWorkspaceChatsPage } from "./use-workspace-chats-page";

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspace: vi.fn(),
  listWorkspaceChats: vi.fn(),
  createWorkspaceChat: vi.fn(),
  deleteWorkspaceChat: vi.fn()
}));

import { getWorkspace, listWorkspaceChats } from "../lib/workspaces-api.js";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useWorkspaceChatsPage", () => {
  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue({
      id: "w1",
      name: "Checkout",
      members: [{ projectId: "p1" }],
      routes: []
    } as never);
    vi.mocked(listWorkspaceChats).mockResolvedValue([
      {
        id: "c1",
        title: "Feature",
        lastActivityAt: new Date().toISOString()
      }
    ] as never);
  });

  it("loads workspace and chats", async () => {
    const { result } = renderHook(() => useWorkspaceChatsPage("w1"), {
      wrapper
    });
    await waitFor(() => {
      expect(result.current.workspace?.name).toBe("Checkout");
    });
    expect(result.current.chats).toHaveLength(1);
    expect(result.current.hasMembers).toBe(true);
  });
});
