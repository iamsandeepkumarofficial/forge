import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_TASK_STREAM_WORKFLOW_PREFIX,
  isAgentTaskStreamWorkflowId
} from "./sessionChatRepository.js";

describe("agent task stream turn ids", () => {
  it("identifies agent-task-stream workflow ids for running-turn exclusion", () => {
    assert.equal(
      isAgentTaskStreamWorkflowId(
        `${AGENT_TASK_STREAM_WORKFLOW_PREFIX}s-p-t-1`
      ),
      true
    );
    assert.equal(isAgentTaskStreamWorkflowId("agent-s1-t1"), false);
  });
});
