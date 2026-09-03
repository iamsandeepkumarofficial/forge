import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUsableBounds,
  normalizeViewBounds,
  parseCaptureRect,
  sameLoadedUrl
} from "./viewBounds.js";

describe("viewBounds", () => {
  it("normalizeViewBounds rounds and floors size at 0", () => {
    assert.deepEqual(
      normalizeViewBounds({ x: 1.6, y: 2.2, width: -4, height: 10.8 }),
      { x: 2, y: 2, width: 0, height: 11 }
    );
  });

  it("isUsableBounds requires positive size", () => {
    assert.equal(isUsableBounds({ x: 0, y: 0, width: 0, height: 10 }), false);
    assert.equal(isUsableBounds({ x: 0, y: 0, width: 10, height: 10 }), true);
  });

  it("parseCaptureRect accepts width/height or w/h", () => {
    assert.deepEqual(parseCaptureRect({ x: 1.2, y: 3.8, w: 10, h: 20 }), {
      x: 1,
      y: 4,
      width: 10,
      height: 20
    });
    assert.equal(parseCaptureRect({ x: 0, y: 0, width: 0, height: 10 }), undefined);
  });

  it("sameLoadedUrl treats about:blank as not loaded", () => {
    assert.equal(sameLoadedUrl("about:blank", "http://a/"), false);
    assert.equal(sameLoadedUrl("http://a/b", "http://a/b"), true);
  });
});
