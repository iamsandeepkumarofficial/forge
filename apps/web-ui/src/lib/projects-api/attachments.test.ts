import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachmentUrl
} from "./attachments";
import { ConnectProjectError } from "./shared";

describe("attachments API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("listAttachments GETs attachment metadata", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "a1",
          fileName: "x.png",
          contentType: "image/png",
          sizeBytes: 10,
          createdAt: "2026-01-01T00:00:00Z"
        }
      ]
    } as Response);
    const items = await listAttachments("p1", "c1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/attachments"
    );
    expect(items[0]?.fileName).toBe("x.png");
  });

  it("uploadAttachment POSTs FormData with options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "a1",
        fileName: "x.png",
        contentType: "image/png",
        sizeBytes: 3,
        createdAt: "2026-01-01T00:00:00Z"
      })
    } as Response);
    const file = new File(["abc"], "x.png", { type: "image/png" });
    const result = await uploadAttachment({
      projectId: "p1",
      chatId: "c1",
      file
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/attachments",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.id).toBe("a1");
  });

  it("deleteAttachment DELETEs with options object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204
    } as Response);
    await deleteAttachment({
      projectId: "p1",
      chatId: "c1",
      attachmentId: "a1"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/projects/p1/chats/c1/attachments/a1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("downloadAttachmentUrl builds the download path", () => {
    expect(
      downloadAttachmentUrl({
        projectId: "p1",
        chatId: "c1",
        attachmentId: "a1"
      })
    ).toBe("http://127.0.0.1:4000/api/projects/p1/chats/c1/attachments/a1");
  });

  it("throws ConnectProjectError when list fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(listAttachments("p1", "c1")).rejects.toBeInstanceOf(
      ConnectProjectError
    );
  });
});
