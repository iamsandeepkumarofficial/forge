import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { touchSessionActivity } from "../../projects/sessionActivity.js";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import { attachShellWindow } from "../../projects/sessionPty.js";
import type { PtyAttachHandle } from "../../projects/sessionPty.js";
import { attachAppLogFollow, attachJobLogFollow } from "../../projects/sessionAppLog.js";
import type { LogFollowHandle } from "../../projects/sessionAppLog.js";
import {
  encodeDataFrame,
  parseClientControlMessage,
  parseDataFrame,
  parseSessionUrl,
  parseStdinFrame,
  parseStreamId,
  SESSION_WS_PATH,
  type ServerControlMessage
} from "./terminalSessionProtocol.js";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MAX_STREAMS_PER_CONNECTION = 8;

type StreamHandle = {
  close: () => void;
  resize?: (cols: number, rows: number) => Promise<void>;
  write?: (chunk: Buffer | string) => void;
};

function sendControl(ws: WebSocket, message: ServerControlMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function openStream(options: {
  sessionId: string;
  containerName: string;
  stream: string;
  onData: (chunk: Buffer) => void;
  onExited: () => void;
}): Promise<StreamHandle> {
  const parsed = parseStreamId(options.stream);
  if (!parsed) {
    throw new Error(`invalid stream id: ${options.stream}`);
  }
  if (parsed.kind === "shell") {
    let attach: PtyAttachHandle | null = null;
    attach = await attachShellWindow({
      container: options.containerName,
      windowName: parsed.name,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      onData: options.onData,
      onClose: options.onExited
    });
    return {
      close: () => attach?.close(),
      resize: (cols, rows) => attach?.resize(cols, rows) ?? Promise.resolve(),
      write: (chunk) => attach?.write(chunk)
    };
  }
  if (parsed.kind === "app") {
    let follow: LogFollowHandle | null = null;
    follow = await attachAppLogFollow({
      containerName: options.containerName,
      appName: parsed.name,
      onData: options.onData,
      onExited: options.onExited
    });
    return { close: () => follow?.close() };
  }
  if (parsed.kind === "job") {
    let follow: LogFollowHandle | null = null;
    follow = await attachJobLogFollow({
      containerName: options.containerName,
      jobName: parsed.name,
      onData: options.onData,
      onExited: options.onExited
    });
    return { close: () => follow?.close() };
  }
  throw new Error(`stream kind not supported: ${parsed.kind}`);
}

async function handleSessionSocket(
  ws: WebSocket,
  request: IncomingMessage
): Promise<void> {
  const params = parseSessionUrl(request.url);
  if (!params) {
    ws.close(1008, "sessionId required");
    return;
  }
  const { sessionId } = params;
  const streams = new Map<string, StreamHandle>();
  const pending = new Map<string, Promise<StreamHandle>>();
  let closed = false;

  const closeAll = () => {
    if (closed) return;
    closed = true;
    pending.clear();
    for (const handle of streams.values()) {
      handle.close();
    }
    streams.clear();
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  };

  ws.on("close", closeAll);
  ws.on("error", closeAll);

  const sendData = (stream: string, chunk: Buffer) => {
    if (ws.readyState !== ws.OPEN || chunk.length === 0) return;
    ws.send(encodeDataFrame(stream, chunk));
  };

  const onSubscribe = async (stream: string) => {
    if (streams.has(stream)) {
      sendControl(ws, { type: "ready", stream });
      return;
    }
    if (
      streams.size + pending.size >= MAX_STREAMS_PER_CONNECTION &&
      !pending.has(stream)
    ) {
      sendControl(ws, {
        type: "error",
        stream,
        message: "too many subscribed streams"
      });
      return;
    }
    let inflight = pending.get(stream);
    if (!inflight) {
      inflight = (async () => {
        const { containerName } = await resolveSandbox(sessionId);
        await touchSessionActivity(sessionId, { force: true });
        return openStream({
          sessionId,
          containerName,
          stream,
          onData: (chunk) => sendData(stream, chunk),
          onExited: () => {
            sendControl(ws, { type: "exited", stream });
            streams.get(stream)?.close();
            streams.delete(stream);
          }
        });
      })();
      pending.set(stream, inflight);
    }
    try {
      const handle = await inflight;
      pending.delete(stream);
      if (closed) {
        handle.close();
        return;
      }
      if (!streams.has(stream)) {
        streams.set(stream, handle);
      }
      sendControl(ws, { type: "ready", stream });
    } catch (err) {
      pending.delete(stream);
      const message = err instanceof Error ? err.message : String(err);
      sendControl(ws, { type: "error", stream, message });
    }
  };

  const onUnsubscribe = (stream: string) => {
    const handle = streams.get(stream);
    if (!handle) return;
    handle.close();
    streams.delete(stream);
  };

  ws.on("message", (data, isBinary) => {
    if (closed) return;
    void touchSessionActivity(sessionId);
    if (isBinary) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const stdin = parseStdinFrame(buf);
      if (!stdin) return;
      const handle = streams.get(stdin.stream);
      handle?.write?.(stdin.payload);
      return;
    }
    const text = typeof data === "string" ? data : data.toString("utf8");
    const control = parseClientControlMessage(text);
    if (!control) return;
    if (control.type === "subscribe") {
      void onSubscribe(control.stream);
      return;
    }
    if (control.type === "unsubscribe") {
      onUnsubscribe(control.stream);
      return;
    }
    const handle = streams.get(control.stream);
    if (handle?.resize) {
      void handle.resize(control.cols, control.rows).catch(() => undefined);
    }
  });
}

export function attachTerminalSessionWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url
      ? new URL(request.url, "http://localhost").pathname
      : "";
    if (pathname !== SESSION_WS_PATH) return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      void handleSessionSocket(ws, request);
    });
  });
}

export { parseDataFrame };
