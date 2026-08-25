import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChatPaneModel } from "./use-chat-pane-model";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchModels: vi.fn(async () => ["gpt-4o"]),
  fetchModelTokenLimits: vi.fn(async () => ({
    contextWindow: 128000,
    maxOutputTokens: null
  }))
}));

describe("useChatPaneModel", () => {
  it("exposes provider and agent mode controls", async () => {
    const { result } = renderHook(() => useChatPaneModel());
    await waitFor(() => expect(result.current.modelsLoading).toBe(false));
    expect(result.current.agentMode).toBeTruthy();
    expect(typeof result.current.setAgentMode).toBe("function");
  });
});
