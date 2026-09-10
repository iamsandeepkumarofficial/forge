import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSemVer, versionSatisfiesRange } from "./versionSatisfy.js";

describe("versionSatisfy", () => {
  it("parses versions", () => {
    assert.deepEqual(parseSemVer("v20.11.1"), {
      major: 20,
      minor: 11,
      patch: 1
    });
  });

  it("handles common engines ranges", () => {
    assert.equal(versionSatisfiesRange("20.11.1", ">=18"), true);
    assert.equal(versionSatisfiesRange("16.0.0", ">=18"), false);
    assert.equal(versionSatisfiesRange("18.20.0", "^18"), true);
    assert.equal(versionSatisfiesRange("19.0.0", "^18"), false);
    assert.equal(versionSatisfiesRange("20.0.0", "18"), false);
    assert.equal(versionSatisfiesRange("18.5.0", "18"), true);
    assert.equal(versionSatisfiesRange("18.5.0", ">=18 <20"), true);
    assert.equal(versionSatisfiesRange("20.0.0", ">=18 <20"), false);
    assert.equal(versionSatisfiesRange("20.0.0", "18 || 20"), true);
  });
});
