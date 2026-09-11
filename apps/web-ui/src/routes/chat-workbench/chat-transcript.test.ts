import { describe, expect, it } from "vitest";
import { CHAT_STARTERS } from "./chat-transcript";

describe("chat-transcript exports", () => {
  it("re-exports starters", () => {
    expect(CHAT_STARTERS.length).toBeGreaterThan(0);
  });
});
