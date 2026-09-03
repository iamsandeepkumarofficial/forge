import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOverflowMenuArg, previewOverflowItems } from "./previewMenuItems.js";

describe("previewMenuItems", () => {
  it("parses zoom and anchor", () => {
    assert.equal(parseOverflowMenuArg(null).zoom, 100);
    assert.deepEqual(parseOverflowMenuArg({ zoom: 125, x: 10.4, y: 20.6 }), {
      zoom: 125,
      x: 10,
      y: 21
    });
  });

  it("lists screenshot, zoom, and cleanup actions", () => {
    const labels = previewOverflowItems(100)
      .filter((item) => item.type === "action")
      .map((item) => item.label);
    assert.deepEqual(labels, [
      "Take Screenshot",
      "Capture Area Screenshot",
      "Hard Reload",
      "Copy Current URL",
      "Zoom Out",
      "Actual Size (100%)",
      "Zoom In",
      "Clear Browsing History",
      "Clear Cookies",
      "Clear Cache"
    ]);
    const reset = previewOverflowItems(100).find(
      (item) => item.type === "action" && item.action === "zoomReset"
    );
    assert.equal(reset && reset.type === "action" && reset.enabled, false);
  });
});
