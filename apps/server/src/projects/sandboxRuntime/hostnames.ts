const SESSION_ID_SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;
const HOSTNAME_ID_MAX = 200;
const N_80 = 80;
const N_443 = 443;

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
  const explicit = process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim();
  if (explicit) return explicit;
  const plane =
    process.env.PREVIEW_PUBLIC_ORIGIN?.trim() ||
    process.env.PREVIEW_PLANE_URL?.trim() ||
    "";
  if (/localhost|127\.0\.0\.1/i.test(plane)) return "preview.localhost";
  return "preview.forge.local";
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

/** Public listen port for preview URLs (from PREVIEW_PUBLIC_ORIGIN or PREVIEW_PLANE_URL). */
export function previewPublicPort(): number | null {
  const raw =
    process.env.PREVIEW_PUBLIC_ORIGIN?.trim() ||
    process.env.PREVIEW_PLANE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (u.port) return Number(u.port);
    return u.protocol === "https:" ? N_443 : N_80;
  } catch {
    return null;
  }
}

export function previewUrlForHostname(
  hostname: string,
  scheme = "https"
): string {
  const port = previewPublicPort();
  const defaultPort = scheme === "https" ? N_443 : N_80;
  if (port != null && port !== defaultPort) {
    return `${scheme}://${hostname}:${port}`;
  }
  return `${scheme}://${hostname}`;
}
