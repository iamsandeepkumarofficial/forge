import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  parsePreviewHostname,
  previewUrl,
  stripBearer
} from "./hostnames.js";

const ORIG_ENV = { ...process.env };

afterEach(() => {
  for (const key of [
    "FORGE_PREVIEW_BASE_DOMAIN",
    "PREVIEW_PUBLIC_ORIGIN",
    "PREVIEW_PLANE_URL"
  ]) {
    if (ORIG_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIG_ENV[key];
  }
});

describe("parsePreviewHostname", () => {
  it("parses primary s-{id} host", () => {
    const parsed = parsePreviewHostname("s-abc123.preview.forge.local");
    assert.deepEqual(parsed, { sessionId: "abc123", port: null });
  });

  it("parses preview.localhost zone", () => {
    process.env.FORGE_PREVIEW_BASE_DOMAIN = "preview.localhost";
    const parsed = parsePreviewHostname(
      "s-workbench-1.preview.localhost:8081"
    );
    assert.deepEqual(parsed, { sessionId: "workbench-1", port: null });
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

describe("previewUrl", () => {
  it("includes :8081 when PREVIEW_PUBLIC_ORIGIN is set", () => {
    process.env.PREVIEW_PUBLIC_ORIGIN = "http://127.0.0.1:8081";
    assert.equal(
      previewUrl("s-abc.preview.localhost", "http"),
      "http://s-abc.preview.localhost:8081"
    );
  });
});

describe("stripBearer", () => {
  it("reads token after Bearer prefix", () => {
    assert.equal(stripBearer("Bearer secret"), "secret");
  });
});
