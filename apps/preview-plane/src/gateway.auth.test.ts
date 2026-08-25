import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGateway } from "./gateway.js";

describe("gateway.auth", () => {
  it("exports createGateway for auth+proxy", () => {
    assert.equal(typeof createGateway, "function");
  });
});
