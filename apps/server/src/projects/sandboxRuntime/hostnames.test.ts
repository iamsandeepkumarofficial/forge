import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  previewBaseDomain,
  previewUrlForHostname,
  sanitizeSessionIdForHostname,
  sessionPreviewHostname,
  sessionPreviewHostnameForPort
} from "./hostnames.js";

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

  it("builds https url", () => {
    assert.equal(
      previewUrlForHostname("s-x.preview.example.com"),
      "https://s-x.preview.example.com"
    );
  });
});
