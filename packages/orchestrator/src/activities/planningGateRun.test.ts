import assert from "node:assert/strict";
import test from "node:test";
import { formatPlannerChatExcerpt } from "./planningGateRun.js";

test("formatPlannerChatExcerpt keeps user and assistant text", () => {
  const excerpt = formatPlannerChatExcerpt([
    {
      id: "1",
      role: "user",
      parts: [{ type: "text", text: "Plan the auth change" }]
    }
  ]);
  assert.match(excerpt, /user: Plan the auth change/);
});
