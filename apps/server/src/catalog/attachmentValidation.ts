const N_1024 = 1024;
const N_25 = 25;

export const MAX_ATTACHMENT_BYTES = N_25 * N_1024 * N_1024;
export const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-gzip"
]);
export function validateAttachmentUpload(
  contentType: string,
  sizeBytes: number
):
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!ALLOWED_ATTACHMENT_MIME.has(contentType)) {
    return { ok: false, error: `Unsupported file type: ${contentType}` };
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "File exceeds 25MB limit" };
  }
  return { ok: true };
}
