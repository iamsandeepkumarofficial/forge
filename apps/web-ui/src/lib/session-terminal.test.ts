import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAllTerminalLogs } from "./session-terminal";

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
});
