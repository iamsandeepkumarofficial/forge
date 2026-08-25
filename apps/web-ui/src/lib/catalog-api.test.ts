import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchConversations,
  upsertConversation,
  fetchActiveSessionId,
  persistActiveSessionId
} from "./catalog-api";

describe("catalog-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchConversations returns data array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: "1", title: "A", updatedAt: 1 }]
      })
    } as Response);
    const rows = await fetchConversations();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/conversations",
      expect.any(Object)
    );
    expect(rows).toEqual([{ id: "1", title: "A", updatedAt: 1 }]);
  });

  it("upsertConversation PUTs conversation fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", title: "A", updatedAt: 2 })
    } as Response);
    const row = await upsertConversation({
      id: "1",
      title: "A",
      updatedAt: 2
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/conversations/1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(row.updatedAt).toBe(2);
  });

  it("fetchActiveSessionId returns null when empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ activeSessionId: null })
    } as Response);
    expect(await fetchActiveSessionId()).toBeNull();
  });

  it("persistActiveSessionId PUTs ui-state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await persistActiveSessionId("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/ui-state",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ activeSessionId: "s1" })
      })
    );
  });

  it("throws on failed fetchConversations", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "err",
      json: async () => ({ error: "nope" })
    } as Response);
    await expect(fetchConversations()).rejects.toThrow("nope");
  });
});
