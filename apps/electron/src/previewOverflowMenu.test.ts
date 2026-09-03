import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewOverflowItems } from "./previewMenuItems.js";

describe("previewOverflowMenu", () => {
  it("disables actual size when zoom is already 100", () => {
    const reset = previewOverflowItems(100).find(
      (item) => item.type === "action" && item.action === "zoomReset"
    );
    assert.ok(reset && reset.type === "action");
    assert.equal(reset.enabled, false);
  });
});
