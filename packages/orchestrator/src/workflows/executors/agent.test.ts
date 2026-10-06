import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentExecutor } from "./agent.js";

describe("AgentExecutor", () => {
  it("is a TaskExecutor class", () => {
    assert.equal(typeof AgentExecutor, "function");
    const ex = new AgentExecutor({
      buildChildArgs: async () => {
        throw new Error("unused in this unit test");
      }
    });
    assert.equal(typeof ex.execute, "function");
  });
});
