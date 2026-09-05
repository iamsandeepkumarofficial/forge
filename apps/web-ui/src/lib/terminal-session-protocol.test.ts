import { describe, it, expect } from "vitest";
import {
  FRAME_DATA,
  FRAME_STDIN,
  encodeStdinFrame,
  parseDataFrame,
  shellStreamId
} from "./terminal-session-protocol";

describe("terminal-session-protocol", () => {
  it("builds shell stream ids", () => {
    expect(shellStreamId("main")).toBe("shell:main");
  });

  it("encodes and parses binary frames", () => {
    const payload = new TextEncoder().encode("hi");
    const frame = encodeStdinFrame("shell:main", payload);
    expect(frame[0]).toBe(FRAME_STDIN);
    expect(frame[1]).toBe("shell:main".length);

    const data = new Uint8Array(2 + "s1".length + payload.length);
    data[0] = FRAME_DATA;
    data[1] = 2;
    data.set(new TextEncoder().encode("s1"), 2);
    data.set(payload, 4);
    const parsed = parseDataFrame(data);
    expect(parsed?.stream).toBe("s1");
    expect(Array.from(parsed?.payload ?? [])).toEqual(Array.from(payload));
  });

  it("rejects oversized stream ids", () => {
    const longId = "x".repeat(256);
    expect(() => encodeStdinFrame(longId, new Uint8Array([1]))).toThrow(
      /invalid stream id length/
    );
  });
});
