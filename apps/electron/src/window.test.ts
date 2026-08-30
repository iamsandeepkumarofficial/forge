import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { browserWindowOptions } from "./window.js";

describe("browserWindowOptions", () => {
  it("locks down the renderer and sizes the window", () => {
    const opts = browserWindowOptions("/tmp/preload.cjs");
    assert.equal(opts.title, "Forge");
    assert.equal(opts.width, 1280);
    assert.equal(opts.height, 800);
    assert.equal(opts.webPreferences.preload, "/tmp/preload.cjs");
    assert.equal(opts.webPreferences.contextIsolation, true);
    assert.equal(opts.webPreferences.nodeIntegration, false);
    assert.equal(opts.webPreferences.sandbox, true);
  });
});
