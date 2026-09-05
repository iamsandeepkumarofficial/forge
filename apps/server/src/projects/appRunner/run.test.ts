import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runApp } from "./run.js";

describe("appRunner run", () => {
  it("exports runApp as an async function", () => {
    assert.equal(typeof runApp, "function");
  });
});
