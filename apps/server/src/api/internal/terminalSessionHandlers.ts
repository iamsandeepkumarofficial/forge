import type { RawData, WebSocket } from "ws";
import { touchSessionActivity } from "../../projects/sessionActivity.js";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import { attachShellWindow } from "../../projects/sessionPty.js";
import type { PtyAttachHandle } from "../../projects/sessionPty.js";
import {
  attachAppLogFollow,
  attachJobLogFollow
} from "../../projects/sessionAppLog.js";
import type { LogFollowHandle } from "../../projects/sessionAppLog.js";
import {
  encodeDataFrame,
  parseClientControlMessage,
  parseStdinFrame,
  parseStreamId,
  type ServerControlMessage
} from "./terminalSessionProtocol.js";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MAX_STREAMS_PER_CONNECTION = 8;

export type StreamHandle = {
  close: () => void;
  resize?: (cols: number, rows: number) => Promise<void>;
  write?: (chunk: Buffer | string) => void;
};

export function sendControl(
  ws: WebSocket,
  message: ServerControlMessage
): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export async function openStream(options: {
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

export async function subscribeStream(options: {
  ws: WebSocket;
  sessionId: string;
  stream: string;
  streams: Map<string, StreamHandle>;
  pending: Map<string, Promise<StreamHandle>>;
  isClosed: () => boolean;
}): Promise<void> {
  const { ws, sessionId, stream, streams, pending, isClosed } = options;
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
        onData: (chunk) => {
          if (ws.readyState !== ws.OPEN || chunk.length === 0) return;
          ws.send(encodeDataFrame(stream, chunk));
        },
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
    if (isClosed()) {
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
}

export function handleSocketMessage(options: {
  ws: WebSocket;
  sessionId: string;
  data: RawData;
  isBinary: boolean;
  streams: Map<string, StreamHandle>;
  pending: Map<string, Promise<StreamHandle>>;
  isClosed: () => boolean;
}): void {
  const { ws, sessionId, data, isBinary, streams, pending, isClosed } = options;
  if (isClosed()) return;
  void touchSessionActivity(sessionId);
  if (isBinary) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    const stdin = parseStdinFrame(buf);
    if (!stdin) return;
    streams.get(stdin.stream)?.write?.(stdin.payload);
    return;
  }
  const text = typeof data === "string" ? data : data.toString("utf8");
  const control = parseClientControlMessage(text);
  if (!control) return;
  if (control.type === "subscribe") {
    void subscribeStream({
      ws,
      sessionId,
      stream: control.stream,
      streams,
      pending,
      isClosed
    });
    return;
  }
  if (control.type === "unsubscribe") {
    const handle = streams.get(control.stream);
    if (!handle) return;
    handle.close();
    streams.delete(control.stream);
    return;
  }
  const handle = streams.get(control.stream);
  if (handle?.resize) {
    void handle.resize(control.cols, control.rows).catch(() => undefined);
  }
}

export function closeAllStreams(options: {
  ws: WebSocket;
  streams: Map<string, StreamHandle>;
  pending: Map<string, Promise<StreamHandle>>;
  markClosed: () => void;
  alreadyClosed: boolean;
}): void {
  if (options.alreadyClosed) return;
  options.markClosed();
  options.pending.clear();
  for (const handle of options.streams.values()) {
    handle.close();
  }
  options.streams.clear();
  if (options.ws.readyState === options.ws.OPEN) {
    options.ws.close();
  }
}
