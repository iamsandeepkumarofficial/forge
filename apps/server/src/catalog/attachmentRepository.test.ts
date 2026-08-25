import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
function thenable(value) {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    }
  };
}
function chain(finalValue) {
  const api = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}
describe("AttachmentRepository", () => {
  let AttachmentRepository;
  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "att1", fileName: "a.pdf" }]),
          select: () => chain([{ id: "att1" }]),
          delete: () => chain(undefined)
        }),
        chatAttachments: {
          id: "id",
          chatFeatureId: "chatFeatureId",
          createdAt: "createdAt"
        }
      }
    });
    ({ AttachmentRepository } = await import("./attachmentRepository.js"));
  });
  it("create returns inserted attachment", async () => {
    const repo = new AttachmentRepository();
    const row = await repo.create({
      chatFeatureId: "c1",
      uploadedBy: "u1",
      fileName: "a.pdf",
      contentType: "application/pdf",
      sizeBytes: 10,
      storageKey: "k"
    });
    assert.equal(row.id, "att1");
  });
  it("getById returns first row", async () => {
    const repo = new AttachmentRepository();
    assert.equal((await repo.getById("att1")).id, "att1");
  });
});
