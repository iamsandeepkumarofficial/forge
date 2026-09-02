import { runnerUrl } from "./tool-runner.js";
import {
  encodeStdinFrame,
  parseDataFrame,
  shellStreamId,
  type ServerControlMessage
} from "./terminal-session-protocol.js";

export type StreamHandlers = {
  onReady?: () => void;
  onData?: (chunk: Uint8Array) => void;
  onExited?: () => void;
  onError?: (message: string) => void;
};

export function sessionSocketUrl(sessionId: string): string {
  const base = runnerUrl();
  const u = new URL(`${base}/internal/terminal/session`);
  u.searchParams.set("sessionId", sessionId);
  const wsBase = base.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return `${wsBase}${u.pathname}${u.search}`;
}

export function streamIdForShellTab(tabId: string): string {
  return shellStreamId(tabId);
}

/** App tab ids are already `app:{name}`. */
export function streamIdForAppTab(tabId: string): string {
  return tabId;
}

export function streamIdForJobTab(jobName: string): string {
  return `job:${jobName}`;
}

type StreamState = {
  handlers: Set<StreamHandlers>;
  subscribed: boolean;
};

export class TerminalSessionClient {
  private ws: WebSocket | null = null;
  private readonly streams = new Map<string, StreamState>();
  private reconnectTimer: number | undefined;
  private closed = false;

  constructor(private readonly sessionId: string) {}

  connect(): void {
    if (this.closed) return;
    this.clearReconnect();
    const ws = new WebSocket(sessionSocketUrl(this.sessionId));
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      for (const [stream, state] of this.streams) {
        if (state.handlers.size > 0) {
          this.sendSubscribe(stream);
        }
      }
    };
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data) as ServerControlMessage;
          this.dispatchControl(parsed);
        } catch {
          void 0;
        }
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        const frame = parseDataFrame(new Uint8Array(event.data));
        if (!frame) return;
        const state = this.streams.get(frame.stream);
        if (!state) return;
        for (const handler of state.handlers) {
          handler.onData?.(frame.payload);
        }
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      for (const state of this.streams.values()) {
        state.subscribed = false;
      }
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1500);
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  disconnect(): void {
    this.closed = true;
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
    this.streams.clear();
  }

  subscribe(stream: string, handlers: StreamHandlers): () => void {
    let state = this.streams.get(stream);
    if (!state) {
      state = { handlers: new Set(), subscribed: false };
      this.streams.set(stream, state);
    }
    state.handlers.add(handlers);
    if (this.ws?.readyState === WebSocket.OPEN && !state.subscribed) {
      this.sendSubscribe(stream);
    }
    return () => {
      const current = this.streams.get(stream);
      if (!current) return;
      current.handlers.delete(handlers);
      if (current.handlers.size === 0) {
        this.sendUnsubscribe(stream);
        this.streams.delete(stream);
      }
    };
  }

  sendStdin(stream: string, data: string | Uint8Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const payload =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : data;
    this.ws.send(encodeStdinFrame(stream, payload));
  }

  resize(stream: string, cols: number, rows: number): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "resize",
        stream,
        cols,
        rows
      })
    );
  }

  private sendSubscribe(stream: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "subscribe", stream }));
    const state = this.streams.get(stream);
    if (state) state.subscribed = true;
  }

  private sendUnsubscribe(stream: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "unsubscribe", stream }));
  }

  private dispatchControl(message: ServerControlMessage): void {
    const state = this.streams.get(message.stream);
    if (!state) return;
    if (message.type === "ready") {
      state.subscribed = true;
      for (const handler of state.handlers) {
        handler.onReady?.();
      }
      return;
    }
    if (message.type === "exited") {
      state.subscribed = false;
      for (const handler of state.handlers) {
        handler.onExited?.();
      }
      return;
    }
    if (message.type === "error") {
      state.subscribed = false;
      for (const handler of state.handlers) {
        handler.onError?.(message.message);
      }
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
