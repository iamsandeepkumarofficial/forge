import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listLinkedItems,
  createLinkedItem,
  deleteLinkedItem
} from "./linked-items";
import { ConnectProjectError } from "./shared";

describe("linked-items API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("listLinkedItems GETs linked items", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "l1",
          label: "Jira",
          url: "https://example.com/1",
          createdAt: "2026-01-01T00:00:00Z"
        }
      ]
    } as Response);
    const items = await listLinkedItems("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/linked-items"
    );
    expect(items[0]?.label).toBe("Jira");
  });

  it("createLinkedItem POSTs with options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "l1",
        label: "PR",
        url: "https://example.com/pr",
        createdAt: "2026-01-01T00:00:00Z"
      })
    } as Response);
    const item = await createLinkedItem({
      projectId: "p1",
      chatId: "c1",
      label: "PR",
      url: "https://example.com/pr"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/linked-items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          label: "PR",
          url: "https://example.com/pr"
        })
      })
    );
    expect(item.id).toBe("l1");
  });

  it("deleteLinkedItem DELETEs with options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204
    } as Response);
    await deleteLinkedItem({
      projectId: "p1",
      chatId: "c1",
      linkedItemId: "l1"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/linked-items/l1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws ConnectProjectError on list failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(listLinkedItems("p1", "c1")).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });
});
