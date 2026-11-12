import assert from "node:assert/strict";
import test from "node:test";
import { PLANNER_SYSTEM } from "./planPrompt.js";

test("planner system prompt requires task contracts", () => {
  assert.match(PLANNER_SYSTEM, /inputSchema/);
  assert.match(PLANNER_SYSTEM, /outputSchema/);
});
