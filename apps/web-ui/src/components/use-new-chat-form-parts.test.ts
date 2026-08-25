import { describe, it, expect } from "vitest";
import { parentChatOptions } from "./use-new-chat-form-parts";

describe("parentChatOptions", () => {
  it("filters out child chats", () => {
    const rows = parentChatOptions([
      { id: "1", title: "A" },
      { id: "2", title: "B", parentId: "1" }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("1");
  });
});
