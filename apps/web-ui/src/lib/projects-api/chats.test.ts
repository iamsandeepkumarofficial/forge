import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createChat,
  fetchChats,
  fetchChat,
  updateChat,
  deleteChat
} from "./chats";
import { ConnectProjectError } from "./shared";

describe("chats API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("createChat POSTs with options body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", title: "Auth" })
    } as Response);
    const chat = await createChat("p1", { title: "Auth", type: "feature" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"title":"Auth"')
      })
    );
    expect(chat.id).toBe("c1");
  });

  it("createChat requires projectId", async () => {
    await expect(createChat("")).rejects.toBeInstanceOf(ConnectProjectError);
  });

  it("fetchChats GETs project chats", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "c1" }]
    } as Response);
    const chats = await fetchChats("p1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats"
    );
    expect(chats).toHaveLength(1);
  });

  it("fetchChat GETs a single chat", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1" })
    } as Response);
    const chat = await fetchChat("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1"
    );
    expect(chat.id).toBe("c1");
  });

  it("updateChat PATCHes with an options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: "c1", status: "done" })
    } as Response);
    await updateChat({ projectId: "p1", chatId: "c1", status: "done" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "done" })
      })
    );
  });

  it("deleteChat DELETEs the chat", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    await deleteChat("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
