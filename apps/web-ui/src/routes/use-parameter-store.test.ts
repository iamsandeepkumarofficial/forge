import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useParameterStore } from "./use-parameter-store";

vi.mock("../lib/workspaces-api.js", () => ({
  listWorkspaceParameters: vi.fn().mockResolvedValue([]),
  upsertWorkspaceParameter: vi.fn(),
  deleteWorkspaceParameter: vi.fn()
}));

describe("useParameterStore", () => {
  beforeEach(() => vi.clearAllMocks());
  it("loads parameters", async () => {
    const { result } = renderHook(() => useParameterStore("w1"));
    await waitFor(() => expect(result.current.rows).toEqual([]));
  });
});
