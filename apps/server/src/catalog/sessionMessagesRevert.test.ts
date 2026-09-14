import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  idsFromMessageOnward,
  liveMessagePrefix
} from "./sessionMessagesRevert.js";

describe("sessionMessagesRevert", () => {
  const live = [{ id: "u1" }, { id: "a1" }, { id: "u2" }, { id: "a2" }];

  it("list after revert is strictly before the user prompt", () => {
    assert.deepEqual(
      liveMessagePrefix(live, "u2")?.map((row) => row.id),
      ["u1", "a1"]
    );
    assert.deepEqual(idsFromMessageOnward(live, "u2"), ["u2", "a2"]);
  });

  it("returns null when the prompt is already gone", () => {
    assert.equal(liveMessagePrefix(live, "missing"), null);
    assert.equal(idsFromMessageOnward(live, "missing"), null);
  });
});
