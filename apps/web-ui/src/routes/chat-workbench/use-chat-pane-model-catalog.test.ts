import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChatPaneModelCatalog } from "./use-chat-pane-model-catalog";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchModels: vi.fn(async () => ["gpt-4o"]),
  fetchModelTokenLimits: vi.fn(async () => ({
    contextWindow: 128000,
    maxOutputTokens: null
  }))
}));

describe("useChatPaneModelCatalog", () => {
  it("loads provider model catalogs", async () => {
    const setModelByProvider = vi.fn();
    const { result } = renderHook(() =>
      useChatPaneModelCatalog({
        provider: "openai",
        activeModel: "gpt-4o",
        setModelByProvider
      })
    );
    await waitFor(() => expect(result.current.modelsLoading).toBe(false));
    expect(result.current.modelsByProvider.openai).toContain("gpt-4o");
  });
});
