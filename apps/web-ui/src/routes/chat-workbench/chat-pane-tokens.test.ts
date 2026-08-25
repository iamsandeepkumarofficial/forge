import { describe, it, expect } from "vitest";
import { estimateConversationTokens } from "./chat-pane-tokens";

describe("estimateConversationTokens", () => {
  it("estimates from message text length", () => {
    const tokens = estimateConversationTokens({
      messages: [
        { id: "1", role: "user", parts: [{ type: "text", text: "abcd" }] }
      ],
      streamingText: ""
    });
    expect(tokens).toBe(1);
  });

  it("includes tool args and outputs, not only text", () => {
    const tokens = estimateConversationTokens({
      messages: [
        {
          id: "1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "read_file",
              args: { path: "abcd" },
              output: "efghijkl"
            }
          ]
        }
      ],
      streamingText: ""
    });
    expect(tokens).toBeGreaterThan(1);
  });

  it("counts live streaming tool parts", () => {
    const tokens = estimateConversationTokens({
      messages: [],
      streamingText: "",
      liveToolParts: [{ type: "tool-result", output: "abcdefgh" }]
    });
    expect(tokens).toBe(2);
  });
});
