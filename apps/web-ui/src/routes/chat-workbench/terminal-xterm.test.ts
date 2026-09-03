import { describe, it, expect } from "vitest";
import {
  formatXtermBuffer,
  formatXtermLine,
  xtermEmptyBuffer,
  xtermWriteDelta
} from "./terminal-xterm";

describe("terminal-xterm", () => {
  it("wraps a log line in a stream color", () => {
    expect(formatXtermLine({
      label: "web",
      color: "text-blue-400",
      text: "hello"
    })).toBe("\x1b[38;5;75m[web]\x1b[0m hello\r\n");
  });

  it("joins lines and appends only new output", () => {
    const first = formatXtermBuffer([
      { label: "web", color: "text-green-400", text: "a" }
    ]);
    const second = formatXtermBuffer([
      { label: "web", color: "text-green-400", text: "a" },
      { label: "web", color: "text-green-400", text: "b" }
    ]);
    expect(xtermWriteDelta(first, second)).toEqual({
      reset: false,
      chunk: formatXtermLine({
        label: "web",
        color: "text-green-400",
        text: "b"
      })
    });
    expect(xtermWriteDelta(second, first).reset).toBe(true);
  });

  it("uses a distinct empty hint when no streams exist", () => {
    expect(xtermEmptyBuffer(true)).toContain("Start an app");
    expect(xtermEmptyBuffer(false)).toBe("No output yet.\r\n");
  });
});
