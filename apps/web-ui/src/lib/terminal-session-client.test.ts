import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FRAME_DATA } from "./terminal-session-protocol";
import {
  sessionSocketUrl,
  streamIdForAppTab,
  streamIdForJobTab,
  streamIdForShellTab,
  TerminalSessionClient
} from "./terminal-session-client";

describe("terminal-session-client helpers", () => {
  it("maps tab kinds to stream ids", () => {
    expect(streamIdForShellTab("main")).toBe("shell:main");
    expect(streamIdForAppTab("app:web")).toBe("app:web");
    expect(streamIdForJobTab("install")).toBe("job:install");
  });

  it("builds a websocket session URL", () => {
    expect(sessionSocketUrl("s1")).toBe(
      "ws://127.0.0.1:4000/internal/terminal/session?sessionId=s1"
    );
  });
});

describe("TerminalSessionClient", () => {
  let sockets: FakeWebSocket[];

  class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = FakeWebSocket.OPEN;
    binaryType = "arraybuffer";
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    sent: Array<string | ArrayBuffer | Uint8Array> = [];

    constructor(public url: string) {
      sockets.push(this);
      queueMicrotask(() => this.onopen?.());
    }

    send(data: string | ArrayBuffer | Uint8Array) {
      this.sent.push(data);
    }

    close() {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.();
    }
  }

  beforeEach(() => {
    sockets = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("subscribes on connect and sends resize/stdin", async () => {
    const client = new TerminalSessionClient("s1");
    const chunks: string[] = [];
    client.subscribe("shell:main", {
      onData: (chunk) => chunks.push(new TextDecoder().decode(chunk))
    });
    client.connect();
    await Promise.resolve();
    expect(sockets).toHaveLength(1);
    expect(JSON.parse(String(sockets[0]!.sent[0]))).toEqual({
      type: "subscribe",
      stream: "shell:main"
    });

    client.resize({ stream: "shell:main", cols: 80, rows: 24 });
    expect(JSON.parse(String(sockets[0]!.sent.at(-1)))).toEqual({
      type: "resize",
      stream: "shell:main",
      cols: 80,
      rows: 24
    });

    client.sendStdin("shell:main", "ls\n");
    const stdin = sockets[0]!.sent.at(-1);
    expect(stdin).toBeInstanceOf(Uint8Array);

    const payload = new TextEncoder().encode("out");
    const data = new Uint8Array(2 + "shell:main".length + payload.length);
    data[0] = FRAME_DATA;
    data[1] = "shell:main".length;
    data.set(new TextEncoder().encode("shell:main"), 2);
    data.set(payload, 2 + "shell:main".length);
    sockets[0]!.onmessage?.({ data: data.buffer });
    expect(chunks).toEqual(["out"]);

    client.disconnect();
  });
});
