import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultExecutorRegistry } from "./createRegistry.js";
import { ExecutorRegistry } from "./registry.js";

describe("createDefaultExecutorRegistry", () => {
  it("registers agent human and tool", () => {
    const registry = createDefaultExecutorRegistry(
      {
        args: {
          sessionId: "s",
          turnId: "t",
          provider: "openai",
          mode: "agent"
        },
        planId: "p",
        version: 1,
        maxConcurrency: 1,
        short: {}
      } as never,
      async () => ({ success: true, output: "ok" })
    );
    assert.ok(registry instanceof ExecutorRegistry);
    assert.ok(registry.has("agent"));
    assert.ok(registry.has("human"));
    assert.ok(registry.has("tool"));
  });
});
