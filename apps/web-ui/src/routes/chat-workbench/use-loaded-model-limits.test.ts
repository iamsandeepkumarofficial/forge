import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLoadedModelLimits } from "./use-loaded-model-limits";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchModelTokenLimits: vi.fn(async () => ({
    contextWindow: 128000,
    maxOutputTokens: 8192
  }))
}));

describe("useLoadedModelLimits", () => {
  it("loads context window and max output for the active model", async () => {
    const { result } = renderHook(() =>
      useLoadedModelLimits({
        provider: "openai-compatible",
        activeModel: "nvidia/nemotron"
      })
    );
    await waitFor(() => expect(result.current.contextWindow).toBe(128000));
    expect(result.current.maxOutputTokens).toBe(8192);
  });
});
