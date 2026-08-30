import { describe, it, expect, vi } from "vitest";
import {
  appLogsByStream,
  buildAppStreams,
  buildJobStreams,
  countRunningStreams,
  formatShellEntry,
  jobNameFromCommand,
  shouldRunInBackground
} from "./terminal-model";

describe("terminal-model", () => {
  it("treats watch/tail as long-running", () => {
    expect(shouldRunInBackground("pnpm test --watch")).toBe(true);
    expect(shouldRunInBackground("tail -f /tmp/out")).toBe(true);
    expect(shouldRunInBackground("pnpm test")).toBe(false);
    expect(shouldRunInBackground("grep -w foo")).toBe(false);
  });

  it("names user jobs from the command", () => {
    vi.spyOn(Date, "now").mockReturnValue(0xabc);
    expect(jobNameFromCommand("pnpm test")).toMatch(/^u-pnpm-test-/);
  });

  it("builds app and job streams and counts running ones", () => {
    const streams = [
      ...buildAppStreams([{ name: "web", running: true }]),
      ...buildJobStreams([
        { name: "install", running: true, command: "pnpm i" }
      ])
    ];
    expect(streams.map((s) => s.id)).toEqual(["app:web", "job:install"]);
    expect(countRunningStreams(streams)).toBe(2);
    expect(appLogsByStream({ web: "ok" })).toEqual({ "app:web": "ok" });
    expect(formatShellEntry("ls", "a\n")).toBe("$ ls\na");
  });
});
