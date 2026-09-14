import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHostDesktopMode, NATIVE_DATABASE_URL } from "./hostMode.js";

describe("hostMode", () => {
  it("always uses native desktop catalog stack", () => {
    assert.equal(isHostDesktopMode({}), true);
    assert.equal(isHostDesktopMode({ FORGE_CLOUD_SANDBOX: "docker" }), true);
  });

  it("exposes native catalog database URL", () => {
    assert.match(NATIVE_DATABASE_URL, /127\.0\.0\.1:5433\/forge/);
  });
});
