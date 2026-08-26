import { describe, it, expect, vi, beforeEach } from "vitest";
import { getActivity } from "./activity";
import { ConnectProjectError } from "./shared";

describe("getActivity", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filter: "history",
          entries: [],
          nextBefore: null
        })
      })
    );
  });

  it("requests activity with filter query", async () => {
    const result = await getActivity({
      projectId: "p1",
      chatId: "c1",
      filter: "history"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/activity?filter=history"
    );
    expect(result.filter).toBe("history");
  });

  it("throws ConnectProjectError when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false
    } as Response);
    await expect(
      getActivity({ projectId: "p1", chatId: "c1" })
    ).rejects.toBeInstanceOf(ConnectProjectError);
  });
});
