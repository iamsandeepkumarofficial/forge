import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAttachmentUpload,
  MAX_ATTACHMENT_BYTES
} from "../catalog/attachmentValidation.js";
describe("validateAttachmentUpload", () => {
  it("accepts common types under the size limit", () => {
    assert.deepEqual(validateAttachmentUpload("application/pdf", 1000), {
      ok: true
    });
  });
  it("rejects unsupported MIME", () => {
    assert.deepEqual(validateAttachmentUpload("application/x-msdownload", 10), {
      ok: false,
      error: "Unsupported file type: application/x-msdownload"
    });
  });
  it("rejects oversized files", () => {
    assert.deepEqual(
      validateAttachmentUpload("image/png", MAX_ATTACHMENT_BYTES + 1),
      { ok: false, error: "File exceeds 25MB limit" }
    );
  });
});
