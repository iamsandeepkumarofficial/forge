import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  closeAllStreams,
  sendControl,
  type StreamHandle
} from "./terminalSessionHandlers.js";

class FakeWs extends EventEmitter {
  readyState = 1;
  OPEN = 1;
  sent: string[] = [];
  closed = false;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
}

describe("terminalSessionHandlers", () => {
  it("sendControl only sends when socket is open", () => {
    const ws = new FakeWs() as unknown as import("ws").WebSocket & FakeWs;
    sendControl(ws, { type: "ready", stream: "shell:main" });
    assert.equal(ws.sent.length, 1);
    assert.match(ws.sent[0]!, /ready/);
    ws.readyState = 3;
    sendControl(ws, { type: "ready", stream: "shell:main" });
    assert.equal(ws.sent.length, 1);
  });

  it("closeAllStreams closes handles once and clears maps", () => {
    const ws = new FakeWs() as unknown as import("ws").WebSocket & FakeWs;
    let closedCount = 0;
    const handle: StreamHandle = {
      close: () => {
        closedCount += 1;
      }
    };
    const streams = new Map<string, StreamHandle>([["shell:main", handle]]);
    const pending = new Map<string, Promise<StreamHandle>>();
    let marked = false;
    closeAllStreams({
      ws,
      streams,
      pending,
      alreadyClosed: false,
      markClosed: () => {
        marked = true;
      }
    });
    assert.equal(marked, true);
    assert.equal(closedCount, 1);
    assert.equal(streams.size, 0);
    assert.equal(ws.closed, true);
    closeAllStreams({
      ws,
      streams,
      pending,
      alreadyClosed: true,
      markClosed: () => {
        marked = false;
      }
    });
    assert.equal(closedCount, 1);
    assert.equal(marked, true);
  });
});
