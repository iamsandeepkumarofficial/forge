import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appRequestBaseUrl,
  joinAppRequestUrl,
  methodAllowsBody,
  parseHttpMethod,
  sanitizeRequestHeaders
} from "./httpRequest.js";

describe("httpRequest helpers", () => {
  it("prefers hostPort over preview url", () => {
    assert.equal(
      appRequestBaseUrl({
        hostPort: 13000,
        url: "http://p3000-s.preview.localhost:8081/"
      }),
      "http://127.0.0.1:13000"
    );
    assert.equal(
      appRequestBaseUrl({ url: "http://p3000-s.preview.localhost:8081/" }),
      "http://p3000-s.preview.localhost:8081/"
    );
    assert.equal(appRequestBaseUrl({}), undefined);
  });

  it("joins same-origin paths and rejects other hosts", () => {
    const base = "http://127.0.0.1:13000/";
    assert.equal(joinAppRequestUrl(base, "/health"), "http://127.0.0.1:13000/health");
    assert.equal(
      joinAppRequestUrl(base, "http://127.0.0.1:13000/v1"),
      "http://127.0.0.1:13000/v1"
    );
    assert.equal(joinAppRequestUrl(base, "https://evil.example/x"), undefined);
  });

  it("parses methods and strips hop-by-hop headers", () => {
    assert.equal(parseHttpMethod("post"), "POST");
    assert.equal(parseHttpMethod("TRACE"), undefined);
    assert.equal(methodAllowsBody("GET"), false);
    assert.equal(methodAllowsBody("POST"), true);
    assert.deepEqual(
      sanitizeRequestHeaders({
        Authorization: "Bearer x",
        Host: "evil",
        "Content-Type": "application/json"
      }),
      { Authorization: "Bearer x", "Content-Type": "application/json" }
    );
  });
});
