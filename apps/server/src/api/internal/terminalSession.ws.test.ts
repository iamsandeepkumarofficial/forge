import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { encodeDataFrame, SESSION_WS_PATH } from "./terminalSessionProtocol.js";

describe("terminalSession.ws", () => {
  let attachTerminalSessionWebSocket: typeof import("./terminalSession.ws.js").attachTerminalSessionWebSocket;
  let parseDataFrame: typeof import("./terminalSession.ws.js").parseDataFrame;
  let upgradeHandler:
    ((request: IncomingMessage, socket: unknown, head: Buffer) => void) | null =
    null;
  let handleUpgradeImpl:
    | ((
        request: IncomingMessage,
        socket: unknown,
        head: Buffer,
        cb: (
          ws: EventEmitter & {
            readyState: number;
            OPEN: number;
            send: (d: unknown) => void;
            close: () => void;
          }
        ) => void
      ) => void)
    | null = null;

  const shells: Array<{ windowName: string }> = [];

  before(async () => {
    mock.module("ws", {
      namedExports: {
        WebSocketServer: class {
          handleUpgrade(
            request: IncomingMessage,
            socket: unknown,
            head: Buffer,
            cb: (
              ws: EventEmitter & {
                readyState: number;
                OPEN: number;
                send: (d: unknown) => void;
                close: () => void;
              }
            ) => void
          ) {
            handleUpgradeImpl?.(request, socket, head, cb);
          }
        }
      }
    });
    mock.module("../../projects/sessionActivity.js", {
      exports: {
        touchSessionActivity: async () => true
      }
    });
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({ containerName: "forge-sandbox-s1" })
      }
    });
    mock.module("../../projects/sessionPty.js", {
      exports: {
        attachShellWindow: async (opts: {
          windowName: string;
          onData: (c: Buffer) => void;
          onClose: () => void;
        }) => {
          shells.push({ windowName: opts.windowName });
          return {
            close: () => undefined,
            resize: async () => undefined,
            write: () => undefined
          };
        }
      }
    });
    mock.module("../../projects/sessionAppLog.js", {
      exports: {
        attachAppLogFollow: async () => ({ close: () => undefined }),
        attachJobLogFollow: async () => ({ close: () => undefined })
      }
    });
    ({ attachTerminalSessionWebSocket, parseDataFrame } =
      await import("./terminalSession.ws.js"));
  });

  it("re-exports parseDataFrame", () => {
    const frame = encodeDataFrame("shell:main", Buffer.from("hi"));
    assert.deepEqual(parseDataFrame(frame), {
      stream: "shell:main",
      payload: Buffer.from("hi")
    });
  });

  it("registers upgrade handler only for session path", () => {
    upgradeHandler = null;
    handleUpgradeImpl = null;
    const server = new EventEmitter() as EventEmitter & {
      on: typeof EventEmitter.prototype.on;
    };
    const origOn = server.on.bind(server);
    server.on = ((event: string, listener: (...args: never[]) => void) => {
      if (event === "upgrade") {
        upgradeHandler = listener as typeof upgradeHandler;
      }
      return origOn(event, listener);
    }) as typeof server.on;

    attachTerminalSessionWebSocket(server as never);
    assert.ok(upgradeHandler);

    let upgraded = false;
    handleUpgradeImpl = (_req, _sock, _head, cb) => {
      upgraded = true;
      const ws = new EventEmitter() as EventEmitter & {
        readyState: number;
        OPEN: number;
        send: (d: unknown) => void;
        close: () => void;
      };
      ws.OPEN = 1;
      ws.readyState = 1;
      ws.send = () => undefined;
      ws.close = () => undefined;
      cb(ws);
    };

    upgradeHandler!(
      { url: "/other?sessionId=s1" } as IncomingMessage,
      {},
      Buffer.alloc(0)
    );
    assert.equal(upgraded, false);

    upgradeHandler!(
      {
        url: `${SESSION_WS_PATH}?sessionId=s1`
      } as IncomingMessage,
      {},
      Buffer.alloc(0)
    );
    assert.equal(upgraded, true);
  });

  it("closes websocket when sessionId is missing", async () => {
    let closedCode: number | undefined;
    handleUpgradeImpl = (_req, _sock, _head, cb) => {
      const ws = new EventEmitter() as EventEmitter & {
        readyState: number;
        OPEN: number;
        send: (d: unknown) => void;
        close: (code?: number, reason?: string) => void;
      };
      ws.OPEN = 1;
      ws.readyState = 1;
      ws.send = () => undefined;
      ws.close = (code?: number) => {
        closedCode = code;
      };
      cb(ws);
    };
    const server = new EventEmitter();
    attachTerminalSessionWebSocket(server as never);
    const listeners = server.listeners("upgrade");
    const handler = listeners[listeners.length - 1] as typeof upgradeHandler;
    handler!(
      { url: `${SESSION_WS_PATH}` } as IncomingMessage,
      {},
      Buffer.alloc(0)
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(closedCode, 1008);
  });

  it("subscribes shell stream and sends ready", async () => {
    shells.length = 0;
    const sent: unknown[] = [];
    let wsRef: EventEmitter | null = null;
    handleUpgradeImpl = (_req, _sock, _head, cb) => {
      const ws = new EventEmitter() as EventEmitter & {
        readyState: number;
        OPEN: number;
        send: (d: unknown) => void;
        close: () => void;
      };
      ws.OPEN = 1;
      ws.readyState = 1;
      ws.send = (d) => {
        sent.push(typeof d === "string" ? JSON.parse(d) : d);
      };
      ws.close = () => undefined;
      wsRef = ws;
      cb(ws);
    };
    const server = new EventEmitter();
    attachTerminalSessionWebSocket(server as never);
    const listeners = server.listeners("upgrade");
    const handler = listeners[listeners.length - 1] as typeof upgradeHandler;
    handler!(
      { url: `${SESSION_WS_PATH}?sessionId=s1` } as IncomingMessage,
      {},
      Buffer.alloc(0)
    );
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(wsRef);
    wsRef!.emit(
      "message",
      JSON.stringify({ type: "subscribe", stream: "shell:main" }),
      false
    );
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(shells[0]?.windowName, "main");
    assert.ok(
      sent.some(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type: string }).type === "ready" &&
          (m as { stream: string }).stream === "shell:main"
      )
    );
  });
});
