import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { playwrightFetchInSession } from "./playwrightFetch.js";
import { executeWebTool } from "../executeWebTool.js";
describe("web_fetch fail-closed", () => {
  it("rejects SSRF targets before docker", async () => {
    const r = await playwrightFetchInSession(
      "any-session",
      "http://127.0.0.1/"
    );
    assert.equal(r.success, false);
    assert.equal(r.metadata.code, "ssrf");
  });
  it("rejects when gate is off", async () => {
    const prev = process.env.WEB_TOOLS_ENABLED;
    process.env.WEB_TOOLS_ENABLED = "0";
    try {
      const r = await executeWebTool({
        sessionId: "s1",
        toolName: "web_fetch",
        args: { url: "https://example.com" },
        turnId: "t1"
      });
      assert.equal(r.success, false);
      assert.equal(r.metadata.code, "disabled");
    } finally {
      if (prev === undefined) delete process.env.WEB_TOOLS_ENABLED;
      else process.env.WEB_TOOLS_ENABLED = prev;
    }
  });
});
describe("web_search fail-closed gate", () => {
  it("returns disabled when WEB_TOOLS_ENABLED is false", async () => {
    const prev = process.env.WEB_TOOLS_ENABLED;
    delete process.env.WEB_TOOLS_ENABLED;
    try {
      const r = await executeWebTool({
        sessionId: "s1",
        toolName: "web_search",
        args: { query: "example" },
        turnId: "t1"
      });
      assert.equal(r.success, false);
      assert.equal(r.metadata.code, "disabled");
    } finally {
      if (prev === undefined) delete process.env.WEB_TOOLS_ENABLED;
      else process.env.WEB_TOOLS_ENABLED = prev;
    }
  });
});
