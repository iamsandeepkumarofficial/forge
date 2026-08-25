import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAttachmentUpload,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIME
} from "./attachmentValidation.js";

describe("attachmentValidation", () => {
  it("accepts allowed MIME types under the size limit", () => {
    for (const mime of [
      "image/png",
      "application/pdf",
      "text/plain",
      "application/zip"
    ]) {
      assert.deepEqual(validateAttachmentUpload(mime, 1024), { ok: true });
    }
  });

  it("rejects unsupported MIME types", () => {
    assert.deepEqual(validateAttachmentUpload("application/x-msdownload", 10), {
      ok: false,
      error: "Unsupported file type: application/x-msdownload"
    });
  });

  it("rejects oversized files", () => {
    assert.deepEqual(
      validateAttachmentUpload("image/jpeg", MAX_ATTACHMENT_BYTES + 1),
      { ok: false, error: "File exceeds 25MB limit" }
    );
  });

  it("exposes a non-empty allowlist and 25MB cap", () => {
    assert.ok(ALLOWED_ATTACHMENT_MIME.size >= 10);
    assert.equal(MAX_ATTACHMENT_BYTES, 25 * 1024 * 1024);
  });
});
