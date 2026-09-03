import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAllTerminalLogs,
  runTerminalCommand,
  stopTerminalJob
} from "./session-terminal";

describe("session-terminal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches all terminal job logs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [{ name: "install", running: true, command: "pnpm i" }],
        logs: { install: "ok\n" }
      })
    } as Response);
    const result = await fetchAllTerminalLogs("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/logs?sessionId=s1",
      expect.any(Object)
    );
    expect(result.jobs[0]?.name).toBe("install");
    expect(result.logs.install).toBe("ok\n");
  });

  it("runs and stops terminal jobs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, output: "a\n" })
    } as Response);
    const ran = await runTerminalCommand({
      sessionId: "s1",
      command: "ls",
      background: false
    });
    expect(ran.output).toBe("a\n");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/run",
      expect.objectContaining({ method: "POST" })
    );
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true })
    } as Response);
    await stopTerminalJob("s1", "install");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/stop",
      expect.objectContaining({ method: "POST" })
    );
  });
});
