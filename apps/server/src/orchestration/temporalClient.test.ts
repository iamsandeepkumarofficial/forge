import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("temporalClient orchestration gate", () => {
  const prevWorkflow = process.env.WORKFLOW_ORCHESTRATION_ENABLED;
  const prevSdlc = process.env.SDLC_ORCHESTRATION_ENABLED;
  afterEach(() => {
    if (prevWorkflow === undefined)
      delete process.env.WORKFLOW_ORCHESTRATION_ENABLED;
    else process.env.WORKFLOW_ORCHESTRATION_ENABLED = prevWorkflow;
    if (prevSdlc === undefined) delete process.env.SDLC_ORCHESTRATION_ENABLED;
    else process.env.SDLC_ORCHESTRATION_ENABLED = prevSdlc;
  });

  it("describePipelineWorkflow returns unavailable when disabled", async () => {
    delete process.env.WORKFLOW_ORCHESTRATION_ENABLED;
    delete process.env.SDLC_ORCHESTRATION_ENABLED;
    const {
      describePipelineWorkflow,
      queryWorkflowState,
      startPipelineWorkflow
    } = await import("./temporalClient.js");
    assert.deepEqual(await describePipelineWorkflow("card-1"), {
      status: "unavailable"
    });
    assert.equal(await queryWorkflowState("card-1"), null);
    await startPipelineWorkflow("card-1");
  });

  it("retryStage throws when orchestration disabled", async () => {
    delete process.env.WORKFLOW_ORCHESTRATION_ENABLED;
    delete process.env.SDLC_ORCHESTRATION_ENABLED;
    const { retryStage } = await import("./temporalClient.js");
    await assert.rejects(
      () => retryStage("c1", "s1"),
      /Orchestration is not enabled/
    );
  });
});
