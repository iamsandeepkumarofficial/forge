export const FRAME_DATA = 0x01;
export const FRAME_STDIN = 0x02;

const N_MAX_STREAM_ID_LEN = 255;

export type ServerControlMessage =
  | { type: "ready"; stream: string }
  | { type: "exited"; stream: string }
  | { type: "error"; stream: string; message: string };

export function shellStreamId(windowName: string): string {
  return `shell:${windowName}`;
}

export function encodeStdinFrame(
  stream: string,
  payload: Uint8Array
): Uint8Array {
  const streamBytes = new TextEncoder().encode(stream);
  if (streamBytes.length === 0 || streamBytes.length > N_MAX_STREAM_ID_LEN) {
    throw new Error("invalid stream id length");
  }
  const out = new Uint8Array(2 + streamBytes.length + payload.length);
  out[0] = FRAME_STDIN;
  out[1] = streamBytes.length;
  out.set(streamBytes, 2);
  out.set(payload, 2 + streamBytes.length);
  return out;
}

export function parseDataFrame(buf: Uint8Array): {
  stream: string;
  payload: Uint8Array;
} | null {
  if (buf.length < 2 || buf[0] !== FRAME_DATA) return null;
  const len = buf[1]!;
  if (buf.length < 2 + len) return null;
  const stream = new TextDecoder().decode(buf.subarray(2, 2 + len));
  return { stream, payload: buf.subarray(2 + len) };
}
