import { describe, expect, it } from "vitest";
import { looksLikePlan } from "./chat-message-turns";

describe("looksLikePlan", () => {
  it("detects numbered plans", () => {
    expect(looksLikePlan("1. Install deps\n2. Start the app")).toBe(true);
    expect(looksLikePlan("Just a sentence.")).toBe(false);
  });
});
