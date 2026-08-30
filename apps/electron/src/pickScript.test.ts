import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANCEL_PICK_SCRIPT, PICK_SCRIPT } from "./pickScript.js";

describe("pickScript", () => {
  it("listens for a click and can cancel", () => {
    assert.match(PICK_SCRIPT, /__forgeCancelPick\) window\.__forgeCancelPick/);
    assert.match(PICK_SCRIPT, /addEventListener\("click"/);
    assert.match(PICK_SCRIPT, /addEventListener\("mousemove"/);
    assert.match(PICK_SCRIPT, /data-forge-hl/);
    assert.match(PICK_SCRIPT, /nearby/);
    assert.match(PICK_SCRIPT, /__forgeCancelPick/);
    assert.match(CANCEL_PICK_SCRIPT, /__forgeCancelPick/);
  });
});
