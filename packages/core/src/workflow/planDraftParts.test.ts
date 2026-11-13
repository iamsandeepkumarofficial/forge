import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlanSections } from "./planDraftParts.js";

describe("parsePlanSections", () => {
  it("drops entries that are missing a title or body", () => {
    assert.deepEqual(
      parsePlanSections([
        { title: "Problem", body: "No session" },
        { title: "", body: "skip" }
      ]),
      [{ title: "Problem", body: "No session" }]
    );
  });
});
