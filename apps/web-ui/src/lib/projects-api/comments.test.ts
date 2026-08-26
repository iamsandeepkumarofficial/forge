import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchComments, createComment } from "./comments";
import { ConnectProjectError } from "./shared";

describe("comments API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchComments GETs comments for a chat", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "cm1",
          chatFeatureId: "c1",
          userId: "u1",
          text: "hi",
          createdAt: "2026-01-01T00:00:00Z"
        }
      ]
    } as Response);
    const comments = await fetchComments("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/comments"
    );
    expect(comments[0]?.text).toBe("hi");
  });

  it("fetchComments requires ids", async () => {
    await expect(fetchComments("", "c1")).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });

  it("createComment POSTs with an options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "cm1",
        chatFeatureId: "c1",
        userId: "u1",
        text: "note",
        createdAt: "2026-01-01T00:00:00Z"
      })
    } as Response);
    const comment = await createComment({
      projectId: "p1",
      chatId: "c1",
      text: "note"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "note" })
      })
    );
    expect(comment.text).toBe("note");
  });
});
