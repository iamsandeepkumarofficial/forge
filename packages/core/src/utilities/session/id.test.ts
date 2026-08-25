import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSessionId } from "./id.js";

test("sanitizeSessionId strips unsafe characters", () => {
  assert.equal(sanitizeSessionId("abc def!"), "abc-def-");
});

test("sanitizeSessionId falls back when empty", () => {
  assert.equal(sanitizeSessionId(""), "session");
});
