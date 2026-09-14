import { describe, it, expect } from "vitest";
import { xtermWriteDelta } from "./terminal-xterm";

describe("terminal-xterm", () => {
  it("appends only new output when the buffer grows", () => {
    const first = "line one\r\n";
    const second = "line one\r\nline two\r\n";
    expect(xtermWriteDelta(first, second)).toEqual({
      reset: false,
      chunk: "line two\r\n"
    });
    expect(xtermWriteDelta(second, first).reset).toBe(true);
  });
});
