import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAgentsWorkflow } from "./use-agents-workflow";

vi.mock("@/lib/projects-api", () => ({
  getWorkflow: vi.fn(async () => ({
    nodes: [],
    finished: false,
    workflow: { status: "completed" }
  })),
  retryStage: vi.fn(),
  stopWorkflow: vi.fn()
}));

describe("useAgentsWorkflow", () => {
  it("loads a workflow graph", async () => {
    const { result } = renderHook(() =>
      useAgentsWorkflow({ projectId: "p1", chatId: "c1" })
    );
    await waitFor(() => {
      expect(result.current.graph).toBeTruthy();
    });
  });
});
