import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLEAR_HTML, INSPECT_JS, inspectAsset } from "./inspectPage.js";

describe("inspectAsset", () => {
  it("matches inspect html and script paths", () => {
    assert.equal(inspectAsset("/__forge/inspect?src=%2F"), "html");
    assert.equal(inspectAsset("/__forge/inspect.js"), "js");
    assert.equal(inspectAsset("/__forge/clear"), "clear");
    assert.equal(inspectAsset("/app"), null);
  });
});

describe("inspect helpers", () => {
  it("serves screenshot and cookie-clear hooks", () => {
    assert.match(INSPECT_JS, /forge-inspect-pick/);
    assert.match(INSPECT_JS, /nearby/);
    assert.match(INSPECT_JS, /forge-inspect-nav/);
    assert.match(INSPECT_JS, /forge-inspect-shot/);
    assert.match(INSPECT_JS, /forge-inspect-shot-result/);
    assert.match(INSPECT_JS, /forge-devtools-console/);
    assert.match(INSPECT_JS, /forge-devtools-network/);
    assert.match(INSPECT_JS, /forge-devtools-dom/);
    assert.match(CLEAR_HTML, /forge-preview-cleared/);
    assert.match(CLEAR_HTML, /localStorage.clear/);
  });
});
