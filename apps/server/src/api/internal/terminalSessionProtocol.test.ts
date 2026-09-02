import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeDataFrame,
  encodeStdinFrame,
  parseClientControlMessage,
  parseDataFrame,
  parseSessionUrl,
  parseStdinFrame,
  parseStreamId,
  SESSION_WS_PATH,
  shellStreamId
} from "./terminalSessionProtocol.js";

describe("terminalSessionProtocol", () => {
  it("parses session websocket url", () => {
    assert.deepEqual(parseSessionUrl(`${SESSION_WS_PATH}?sessionId=s1`), {
      sessionId: "s1"
    });
    assert.equal(parseSessionUrl(`${SESSION_WS_PATH}`), null);
  });

  it("validates stream ids", () => {
    assert.deepEqual(parseStreamId("shell:main"), {
      kind: "shell",
      name: "main",
      stream: "shell:main"
    });
    assert.deepEqual(parseStreamId("app:web"), {
      kind: "app",
      name: "web",
      stream: "app:web"
    });
    assert.deepEqual(parseStreamId("app:bp-backend/bp-backend"), {
      kind: "app",
      name: "bp-backend/bp-backend",
      stream: "app:bp-backend/bp-backend"
    });
    assert.equal(parseStreamId("shell:"), null);
    assert.equal(parseStreamId("app:bad name"), null);
    assert.equal(shellStreamId("main"), "shell:main");
  });

  it("parses subscribe and resize control messages", () => {
    assert.deepEqual(
      parseClientControlMessage('{"type":"subscribe","stream":"shell:main"}'),
      { type: "subscribe", stream: "shell:main" }
    );
    assert.deepEqual(
      parseClientControlMessage(
        '{"type":"resize","stream":"shell:main","cols":120,"rows":40}'
      ),
      { type: "resize", stream: "shell:main", cols: 120, rows: 40 }
    );
    assert.equal(parseClientControlMessage('{"type":"resize","stream":"app:x"}'), null);
  });

  it("round-trips binary data and stdin frames", () => {
    const data = encodeDataFrame("shell:main", Buffer.from("hello"));
    assert.deepEqual(parseDataFrame(data), {
      stream: "shell:main",
      payload: Buffer.from("hello")
    });
    const stdin = encodeStdinFrame("shell:main", Buffer.from("ls\n"));
    assert.deepEqual(parseStdinFrame(stdin), {
      stream: "shell:main",
      payload: Buffer.from("ls\n")
    });
    assert.equal(parseStdinFrame(encodeStdinFrame("app:web", Buffer.from("x"))), null);
  });
});
