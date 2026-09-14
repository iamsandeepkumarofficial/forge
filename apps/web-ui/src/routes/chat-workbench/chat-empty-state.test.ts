import { describe, expect, it } from "vitest";
import { CHAT_STARTERS } from "./chat-empty-state";

describe("CHAT_STARTERS", () => {
  it("includes workspace explain prompt", () => {
    expect(
      CHAT_STARTERS.some((s) => s.label === "Explain this workspace")
    ).toBe(true);
  });
});
