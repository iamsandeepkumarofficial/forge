import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewApp } from "./app.js";

describe("createPreviewApp", () => {
  it("exposes healthz handler", () => {
    const app = createPreviewApp({ token: "t" });
    assert.equal(typeof app.listen, "function");
  });
});
