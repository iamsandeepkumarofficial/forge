import { sanitizeJobName } from "../../projects/backgroundJob.js";

export const SESSION_WS_PATH = "/internal/terminal/session";

export const FRAME_DATA = 0x01;
export const FRAME_STDIN = 0x02;

export type StreamKind = "shell" | "app" | "job";

export type ParsedStream = {
  kind: StreamKind;
  name: string;
  stream: string;
};

export type ClientControlMessage =
  | { type: "subscribe"; stream: string }
  | { type: "unsubscribe"; stream: string }
  | { type: "resize"; stream: string; cols: number; rows: number };

export type ServerControlMessage =
  | { type: "ready"; stream: string }
  | { type: "exited"; stream: string }
  | { type: "error"; stream: string; message: string };

export function parseSessionUrl(url: string | undefined): { sessionId: string } | null {
  if (!url) return null;
  const parsed = new URL(url, "http://localhost");
  if (parsed.pathname !== SESSION_WS_PATH) return null;
  const sessionId = parsed.searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) return null;
  return { sessionId };
}

export function parseStreamId(stream: string): ParsedStream | null {
  const trimmed = stream.trim();
  const idx = trimmed.indexOf(":");
  if (idx <= 0) return null;
  const kind = trimmed.slice(0, idx) as StreamKind;
  const name = trimmed.slice(idx + 1).trim();
  if (!name || (kind !== "shell" && kind !== "app" && kind !== "job")) {
    return null;
  }
  if (kind === "shell" && name.includes(":")) return null;
  if (kind === "app" || kind === "job") {
    
    
    const sanitized = sanitizeJobName(name);
    if (!sanitized || sanitized !== name.replace(/\//g, "_")) {
      return null;
    }
  }
  return { kind, name, stream: `${kind}:${name}` };
}

export function shellStreamId(windowName: string): string {
  return `shell:${windowName}`;
}

export function parseClientControlMessage(raw: string): ClientControlMessage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = parsed.type;
    if (type === "subscribe" || type === "unsubscribe") {
      const stream = typeof parsed.stream === "string" ? parsed.stream.trim() : "";
      if (!stream || !parseStreamId(stream)) return null;
      return { type, stream };
    }
    if (type === "resize") {
      const stream = typeof parsed.stream === "string" ? parsed.stream.trim() : "";
      const cols = Number(parsed.cols);
      const rows = Number(parsed.rows);
      if (!stream || !parseStreamId(stream) || !Number.isFinite(cols) || !Number.isFinite(rows)) {
        return null;
      }
      return { type: "resize", stream, cols, rows };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeDataFrame(stream: string, payload: Buffer): Buffer {
  const streamBytes = Buffer.from(stream, "utf8");
  if (streamBytes.length === 0 || streamBytes.length > 255) {
    throw new Error("invalid stream id length");
  }
  const header = Buffer.alloc(2 + streamBytes.length);
  header[0] = FRAME_DATA;
  header[1] = streamBytes.length;
  streamBytes.copy(header, 2);
  return Buffer.concat([header, payload]);
}

export function parseDataFrame(buf: Buffer): { stream: string; payload: Buffer } | null {
  if (buf.length < 2 || buf[0] !== FRAME_DATA) return null;
  const len = buf[1]!;
  if (buf.length < 2 + len) return null;
  const stream = buf.subarray(2, 2 + len).toString("utf8");
  return { stream, payload: buf.subarray(2 + len) };
}

export function encodeStdinFrame(stream: string, payload: Buffer): Buffer {
  const streamBytes = Buffer.from(stream, "utf8");
  if (streamBytes.length === 0 || streamBytes.length > 255) {
    throw new Error("invalid stream id length");
  }
  const header = Buffer.alloc(2 + streamBytes.length);
  header[0] = FRAME_STDIN;
  header[1] = streamBytes.length;
  streamBytes.copy(header, 2);
  return Buffer.concat([header, payload]);
}

export function parseStdinFrame(buf: Buffer): { stream: string; payload: Buffer } | null {
  if (buf.length < 2 || buf[0] !== FRAME_STDIN) return null;
  const len = buf[1]!;
  if (buf.length < 2 + len) return null;
  const stream = buf.subarray(2, 2 + len).toString("utf8");
  if (!parseStreamId(stream) || !stream.startsWith("shell:")) return null;
  return { stream, payload: buf.subarray(2 + len) };
}
