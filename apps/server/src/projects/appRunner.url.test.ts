import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveRunningAppUrl } from "./appRunner.js";

const ORIG_ENV = { ...process.env };

afterEach(() => {
  for (const key of [
    "FORGE_PREVIEW_BASE_DOMAIN",
    "PREVIEW_PUBLIC_ORIGIN",
    "PREVIEW_PLANE_URL",
    "PREVIEW_URL_SCHEME"
  ]) {
    if (ORIG_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIG_ENV[key];
  }
});

describe("resolveRunningAppUrl", () => {
  it("prefers proxied hostname URL when preview domain is set", () => {
    process.env.FORGE_PREVIEW_BASE_DOMAIN = "preview.localhost";
    process.env.PREVIEW_URL_SCHEME = "http";
    process.env.PREVIEW_PUBLIC_ORIGIN = "http://127.0.0.1:8081";
    const url = resolveRunningAppUrl({
      running: true,
      sessionId: "sess-1",
      port: 3000,
      hostPort: 40120
    });
    assert.equal(url, "http://s-sess-1.preview.localhost:8081");
  });

  it("falls back to host port when preview domain is unset", () => {
    delete process.env.FORGE_PREVIEW_BASE_DOMAIN;
    delete process.env.PREVIEW_PUBLIC_ORIGIN;
    delete process.env.PREVIEW_PLANE_URL;
    const url = resolveRunningAppUrl({
      running: true,
      sessionId: "sess-1",
      port: 3000,
      hostPort: 40120
    });
    assert.equal(url, "http://127.0.0.1:40120");
  });

  it("uses proxied URL when only PREVIEW_PLANE_URL is set", () => {
    delete process.env.FORGE_PREVIEW_BASE_DOMAIN;
    process.env.PREVIEW_PLANE_URL = "http://127.0.0.1:8081";
    process.env.PREVIEW_URL_SCHEME = "http";
    const url = resolveRunningAppUrl({
      running: true,
      sessionId: "sess-1",
      port: 3000,
      hostPort: 40120
    });
    assert.equal(url, "http://s-sess-1.preview.localhost:8081");
  });

  it("returns undefined when not running", () => {
    process.env.FORGE_PREVIEW_BASE_DOMAIN = "preview.localhost";
    assert.equal(
      resolveRunningAppUrl({
        running: false,
        sessionId: "sess-1",
        port: 3000,
        hostPort: 40120
      }),
      undefined
    );
  });
});
