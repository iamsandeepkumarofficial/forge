import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertHttpUrl, assertPublicHttpUrl } from "./ssrf.js";
describe("assertHttpUrl", () => {
  it("accepts http and https", () => {
    assert.equal(
      assertHttpUrl("https://example.com/a").hostname,
      "example.com"
    );
    assert.equal(assertHttpUrl("http://example.com").protocol, "http:");
  });
  it("rejects non-http schemes", () => {
    assert.throws(
      () => assertHttpUrl("file:///etc/passwd"),
      /unsupported scheme/
    );
    assert.throws(
      () => assertHttpUrl("ftp://example.com"),
      /unsupported scheme/
    );
  });
});
describe("assertPublicHttpUrl", () => {
  it("blocks localhost", async () => {
    await assert.rejects(
      () => assertPublicHttpUrl("http://localhost/"),
      /localhost/
    );
    await assert.rejects(
      () => assertPublicHttpUrl("http://127.0.0.1/"),
      /private/
    );
  });
  it("blocks private IPv4 literals", async () => {
    await assert.rejects(
      () => assertPublicHttpUrl("http://10.0.0.1/"),
      /private/
    );
    await assert.rejects(
      () => assertPublicHttpUrl("http://192.168.1.1/"),
      /private/
    );
    await assert.rejects(
      () => assertPublicHttpUrl("http://172.16.0.1/"),
      /private/
    );
    await assert.rejects(
      () => assertPublicHttpUrl("http://169.254.1.1/"),
      /private/
    );
  });
  it("blocks link-local / ULA IPv6", async () => {
    await assert.rejects(() => assertPublicHttpUrl("http://[::1]/"), /private/);
    await assert.rejects(
      () => assertPublicHttpUrl("http://[fe80::1]/"),
      /private/
    );
  });
  it("allows public https hosts", async () => {
    const u = await assertPublicHttpUrl("https://example.com/docs");
    assert.equal(u.hostname, "example.com");
  });
});
