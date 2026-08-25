import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serializeChatToolDefinitions } from "./serializeChatToolDefinitions.js";

describe("serializeChatToolDefinitions", () => {
  it("includes write tools in agent mode and omits them in ask", () => {
    const agent = serializeChatToolDefinitions({ agentMode: "agent" });
    const ask = serializeChatToolDefinitions({ agentMode: "ask" });
    assert.match(agent, /write_file/);
    assert.match(agent, /read_file/);
    assert.match(ask, /read_file/);
    assert.equal(/write_file/.test(ask), false);
  });

  it("omits web tools when includeWebTools is false", () => {
    const withWeb = serializeChatToolDefinitions({
      agentMode: "agent",
      includeWebTools: true
    });
    const withoutWeb = serializeChatToolDefinitions({
      agentMode: "agent",
      includeWebTools: false
    });
    assert.match(withWeb, /web_search/);
    assert.equal(/web_search/.test(withoutWeb), false);
  });
});
