import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  livePrefixThrough,
  mappedTurnId,
  orderedTurnIds
} from "./sessionBranchCopy.js";

describe("sessionBranchCopy", () => {
  it("slices live messages through the fork id", () => {
    const rows = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
    assert.deepEqual(livePrefixThrough(rows, "m2"), [
      { id: "m1" },
      { id: "m2" }
    ]);
    assert.equal(livePrefixThrough(rows, "missing"), null);
  });

  it("collects distinct turn ids in first-seen order", () => {
    assert.deepEqual(
      orderedTurnIds([
        { turnId: "t1" },
        { turnId: "t1" },
        { turnId: null },
        { turnId: "t2" }
      ]),
      ["t1", "t2"]
    );
  });

  it("maps copied turn ids and drops unknown ones", () => {
    const map = new Map([["t1", "t1b"]]);
    assert.equal(mappedTurnId("t1", map), "t1b");
    assert.equal(mappedTurnId("t2", map), null);
    assert.equal(mappedTurnId(null, map), null);
  });
});
