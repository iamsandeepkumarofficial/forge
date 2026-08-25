import { describe, it, expect } from "vitest";
import { buildUsageRows, estimateTokensFromText } from "./context-usage-math";

describe("context-usage-math", () => {
  it("estimateTokensFromText uses chars/4", () => {
    expect(estimateTokensFromText("abcd")).toBe(1);
  });

  it("counts tool definitions and reserves provider max output", () => {
    const usage = buildUsageRows({
      systemPromptText: "abcd",
      systemPromptLoading: false,
      toolDefinitionTokens: 1000,
      conversationTokens: 80000,
      maxContextTokens: 128000,
      maxOutputTokens: 46080
    });
    expect(usage.rows.find((r) => r.label === "Tool definitions")?.tokens).toBe(
      1000
    );
    expect(usage.percentFull).toBeGreaterThan(90);
    expect(usage.usageSubtitle).toMatch(/81,?\s?920|82K/i);
  });

  it("does not invent an output reserve when the model does not report one", () => {
    const usage = buildUsageRows({
      systemPromptText: "",
      systemPromptLoading: false,
      toolDefinitionTokens: 0,
      conversationTokens: 4000,
      maxContextTokens: 128000,
      maxOutputTokens: null
    });
    expect(usage.percentFull).toBe(3);
  });
});
