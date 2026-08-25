import { describe, it, expect } from "vitest";
import {
  formatTokens,
  AGENT_MODES,
  ALL_PROVIDERS
} from "./chat-composer-shared";

describe("chat-composer-shared", () => {
  it("exposes agent modes and providers", () => {
    expect(AGENT_MODES.some((m) => m.id === "agent")).toBe(true);
    expect(AGENT_MODES.some((m) => m.id === "auto")).toBe(true);
    expect(ALL_PROVIDERS).toContain("openai");
    expect(ALL_PROVIDERS).toContain("openai-compatible");
    expect(ALL_PROVIDERS).not.toContain("ollama");
    expect(ALL_PROVIDERS).not.toContain("custom");
  });

  it("formatTokens abbreviates large counts", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1500)).toBe("2K");
    expect(formatTokens(2000000)).toBe("2M");
  });
});
