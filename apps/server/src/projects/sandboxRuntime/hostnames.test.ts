import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  previewBaseDomain,
  previewPublicPort,
  previewUrlForHostname,
  sanitizeSessionIdForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";

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

describe("sandboxRuntime hostnames", () => {
  it("builds primary session preview hostname", () => {
    const host = sessionPreviewHostname("abc-123");
    assert.equal(host, `s-abc-123.${previewBaseDomain()}`);
  });

  it("builds port-qualified hostname", () => {
    const host = sessionPreviewHostnameForPort("sess1", 3000);
    assert.equal(host, `p3000-s-sess1.${previewBaseDomain()}`);
  });

  it("rejects empty session id", () => {
    assert.throws(() => sanitizeSessionIdForHostname("..."), /Invalid/);
  });

  it("builds https url without port by default", () => {
    delete process.env.PREVIEW_PUBLIC_ORIGIN;
    delete process.env.PREVIEW_PLANE_URL;
    assert.equal(
      previewUrlForHostname("s-x.preview.example.com"),
      "https://s-x.preview.example.com"
    );
  });

  it("appends public port from PREVIEW_PUBLIC_ORIGIN for local http", () => {
    process.env.PREVIEW_PUBLIC_ORIGIN = "http://127.0.0.1:8081";
    assert.equal(previewPublicPort(), 8081);
    assert.equal(
      previewUrlForHostname("s-abc.preview.localhost", "http"),
      "http://s-abc.preview.localhost:8081"
    );
  });

  it("falls back to PREVIEW_PLANE_URL for public port", () => {
    delete process.env.PREVIEW_PUBLIC_ORIGIN;
    process.env.PREVIEW_PLANE_URL = "http://127.0.0.1:8081";
    assert.equal(
      previewUrlForHostname("s-abc.preview.localhost", "http"),
      "http://s-abc.preview.localhost:8081"
    );
  });
});
