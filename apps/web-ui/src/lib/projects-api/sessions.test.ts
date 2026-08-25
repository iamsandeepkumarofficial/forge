import { describe, it, expect, vi, beforeEach } from "vitest";
import { startSession, getSessionStatus, pushToSession } from "./sessions";
import { ConnectProjectError } from "./shared";

describe("sessions API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("startSession POSTs sessionId", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "s1", status: "ready" })
    } as Response);
    const status = await startSession("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/session/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "s1" })
      })
    );
    expect(status.sessionId).toBe("s1");
  });

  it("startSession requires sessionId", async () => {
    await expect(startSession("")).rejects.toBeInstanceOf(ConnectProjectError);
  });

  it("getSessionStatus GETs status query", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: "s1", status: "ready" })
    } as Response);
    await getSessionStatus("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/session/status?sessionId=s1",
      expect.any(Object)
    );
  });

  it("pushToSession POSTs chatId and content", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await pushToSession("c1", "hello");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/session/push",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chatId: "c1", content: "hello" })
      })
    );
  });
});
