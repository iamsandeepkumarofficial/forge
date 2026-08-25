import { describe, it, expect } from "vitest";
import { usableInputTokens } from "./usable-input-tokens";

describe("usableInputTokens", () => {
  it("returns null without a context window", () => {
    expect(
      usableInputTokens({ contextWindow: null, maxOutputTokens: 4096 })
    ).toBeNull();
    expect(
      usableInputTokens({ contextWindow: 0, maxOutputTokens: null })
    ).toBeNull();
  });

  it("subtracts provider max output when it fits inside the window", () => {
    expect(
      usableInputTokens({
        contextWindow: 128000,
        maxOutputTokens: 46080
      })
    ).toBe(81920);
  });

  it("ignores missing or oversized max output instead of inventing a reserve", () => {
    expect(
      usableInputTokens({ contextWindow: 128000, maxOutputTokens: null })
    ).toBe(128000);
    expect(
      usableInputTokens({ contextWindow: 8192, maxOutputTokens: 8192 })
    ).toBe(8192);
  });
});
