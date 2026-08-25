import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ticketAttachmentKey } from "./objectStore.js";

describe("objectStore helpers", () => {
  it("ticketAttachmentKey builds stable object keys", () => {
    assert.equal(
      ticketAttachmentKey("chat-1", "att-9"),
      "tickets/chat-1/att/att-9"
    );
  });
});
