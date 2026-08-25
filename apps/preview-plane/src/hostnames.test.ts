import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePreviewHostname, stripBearer } from "./hostnames.js";

describe("parsePreviewHostname", () => {
  it("parses primary s-{id} host", () => {
    const parsed = parsePreviewHostname("s-abc123.preview.forge.local");
    assert.deepEqual(parsed, { sessionId: "abc123", port: null });
  });

  it("parses extra p{port}-s-{id} host", () => {
    const parsed = parsePreviewHostname(
      "p3001-s-abc123.preview.example.com:443"
    );
    assert.deepEqual(parsed, { sessionId: "abc123", port: 3001 });
  });

  it("returns null for unrelated hosts", () => {
    assert.equal(parsePreviewHostname("forge.local"), null);
  });
});

describe("stripBearer", () => {
  it("reads token after Bearer prefix", () => {
    assert.equal(stripBearer("Bearer secret"), "secret");
  });
});
