import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTerminalAction } from "./runTerminal.tool.js";

describe("parseTerminalAction", () => {
  it("accepts known actions", () => {
    assert.equal(parseTerminalAction("run"), "run");
    assert.equal(parseTerminalAction("logs"), "logs");
    assert.equal(parseTerminalAction("status"), "status");
    assert.equal(parseTerminalAction("stop"), "stop");
  });

  it("rejects unknown values", () => {
    assert.equal(parseTerminalAction("kill"), undefined);
    assert.equal(parseTerminalAction(1), undefined);
    assert.equal(parseTerminalAction(undefined), undefined);
  });
});
