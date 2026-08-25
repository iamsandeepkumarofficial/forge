import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { parsePipeline, pipelineSchema } from "./schema.js";

const validYaml = `
name: demo
version: 1
finalColumn: done
stages:
  - id: plan
    agent: requirement-gatherer
    column: planning
    action: generate
    commentTitle: Plan
    gate: auto
`;

describe("parsePipeline", () => {
  it("parses a valid pipeline definition", () => {
    const pipeline = parsePipeline(validYaml);
    assert.equal(pipeline.name, "demo");
    assert.equal(pipeline.version, 1);
    assert.equal(pipeline.finalColumn, "done");
    assert.equal(pipeline.stages.length, 1);
    assert.equal(pipeline.stages[0]?.agent, "requirement-gatherer");
    assert.equal(pipeline.stages[0]?.action, "generate");
  });

  it("rejects empty stages", () => {
    assert.throws(
      () =>
        parsePipeline(`
name: empty
version: 1
finalColumn: done
stages: []
`),
      ZodError
    );
  });

  it("rejects invalid stage action", () => {
    assert.throws(
      () =>
        parsePipeline(`
name: bad
version: 1
finalColumn: done
stages:
  - id: x
    agent: a
    column: planning
    action: destroy
    commentTitle: X
    gate: auto
`),
      ZodError
    );
  });
});

describe("pipelineSchema", () => {
  it("requires a positive integer version", () => {
    assert.throws(
      () =>
        pipelineSchema.parse({
          name: "x",
          version: 0,
          finalColumn: "done",
          stages: [
            {
              id: "s",
              agent: "a",
              column: "planning",
              action: "generate",
              commentTitle: "T",
              gate: "human"
            }
          ]
        }),
      ZodError
    );
  });
});
