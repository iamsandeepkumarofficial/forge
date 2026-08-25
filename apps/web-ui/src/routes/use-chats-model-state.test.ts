import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChatsModelState } from "./use-chats-model-state";

vi.mock("../lib/chat-agent.js", () => ({
  fetchModels: vi.fn(async () => ["m1"])
}));

describe("useChatsModelState", () => {
  it("loads model catalogs", async () => {
    const { result } = renderHook(() => useChatsModelState());
    await waitFor(() => expect(result.current.modelsLoading).toBe(false));
    expect(result.current.provider).toBeTruthy();
  });
});
