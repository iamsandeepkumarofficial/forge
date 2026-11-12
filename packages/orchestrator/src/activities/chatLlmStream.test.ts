import assert from "node:assert/strict";
import test from "node:test";
import { streamLlmStepText } from "./chatLlmStream.js";

test("streamLlmStepText is the streamed step entry", () => {
  assert.equal(typeof streamLlmStepText, "function");
});
