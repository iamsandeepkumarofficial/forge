import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument
} from "./documents-api";

const doc = {
  id: "d1",
  userId: "u1",
  projectId: "p1",
  title: "Spec",
  body: "body",
  source: "user" as const,
  agentId: null,
  chatFeatureId: null,
  stageId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z"
};

describe("documents-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("listDocuments appends projectId query", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [doc]
    } as Response);
    const rows = await listDocuments("p1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/documents?projectId=p1",
      expect.any(Object)
    );
    expect(rows[0]?.title).toBe("Spec");
  });

  it("getDocument GETs by id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => doc
    } as Response);
    expect((await getDocument("d1")).id).toBe("d1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/documents/d1",
      expect.any(Object)
    );
  });

  it("createDocument POSTs title/body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => doc
    } as Response);
    await createDocument({ title: "Spec", body: "body", projectId: "p1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/documents",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateDocument PATCHes and deleteDocument DELETEs", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...doc, title: "New" })
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await updateDocument("d1", { title: "New" });
    await deleteDocument("d1");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH"
    });
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: "DELETE"
    });
  });
});
