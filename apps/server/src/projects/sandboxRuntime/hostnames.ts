const SESSION_ID_SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;
const HOSTNAME_ID_MAX = 200;

export function sanitizeSessionIdForHostname(sessionId: string): string {
  const cleaned = sessionId
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^[._-]+/, "")
    .slice(0, HOSTNAME_ID_MAX);
  if (!cleaned || !SESSION_ID_SAFE.test(cleaned)) {
    throw new Error(`Invalid session id for preview hostname: ${sessionId}`);
  }
  return cleaned;
}

export function previewBaseDomain(): string {
  return process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim() || "preview.forge.local";
}

export function sessionPreviewHostname(sessionId: string): string {
  const id = sanitizeSessionIdForHostname(sessionId);
  return `s-${id}.${previewBaseDomain()}`;
}

export function sessionPreviewHostnameForPort(
  sessionId: string,
  port: number
): string {
  const id = sanitizeSessionIdForHostname(sessionId);
  return `p${port}-s-${id}.${previewBaseDomain()}`;
}

export function previewUrlForHostname(
  hostname: string,
  scheme = "https"
): string {
  return `${scheme}://${hostname}`;
}
