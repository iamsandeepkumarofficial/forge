import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_TASK_STREAM_WORKFLOW_PREFIX,
  isAgentTaskStreamWorkflowId
} from "./taskStream.js";

describe("task stream workflow ids", () => {
  it("matches only the child stream prefix", () => {
    assert.equal(
      isAgentTaskStreamWorkflowId(
        `${AGENT_TASK_STREAM_WORKFLOW_PREFIX}s-p-t-1`
      ),
      true
    );
    assert.equal(isAgentTaskStreamWorkflowId("agent-s1-t1"), false);
  });
});
