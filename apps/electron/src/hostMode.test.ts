import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHostDesktopMode, NATIVE_DATABASE_URL } from "./hostMode.js";

describe("hostMode", () => {
  it("detects host vs docker runtime", () => {
    assert.equal(isHostDesktopMode({ FORGE_DESKTOP: "1" }), true);
    assert.equal(isHostDesktopMode({ SANDBOX_RUNTIME: "host" }), true);
    assert.equal(
      isHostDesktopMode({ FORGE_DESKTOP: "1", SANDBOX_RUNTIME: "docker" }),
      false
    );
    assert.equal(isHostDesktopMode({}), false);
  });

  it("exposes native catalog database URL", () => {
    assert.match(NATIVE_DATABASE_URL, /127\.0\.0\.1:5433\/forge/);
  });
});
