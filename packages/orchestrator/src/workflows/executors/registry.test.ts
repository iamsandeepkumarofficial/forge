import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExecutorRegistry } from "./registry.js";
import { HumanExecutor } from "./human.js";

describe("ExecutorRegistry", () => {
  it("registers and returns executors by kind", () => {
    const registry = new ExecutorRegistry().register(
      "human",
      new HumanExecutor()
    );
    assert.ok(registry.has("human"));
    assert.equal(registry.get("missing"), undefined);
  });
});
