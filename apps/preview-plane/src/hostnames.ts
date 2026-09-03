const BEARER_PREFIX = "Bearer ";
const DEFAULT_PREVIEW_ZONE = "preview.forge.local";
const N_80 = 80;
const N_443 = 443;

export type ParsedPreviewHost = {
  sessionId: string;
  port: number | null;
};

function previewZone(): string {
  const explicit = process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim().toLowerCase();
  if (explicit) return explicit;
  const plane =
    process.env.PREVIEW_PUBLIC_ORIGIN?.trim() ||
    process.env.PREVIEW_PLANE_URL?.trim() ||
    "";
  if (/localhost|127\.0\.0\.1/i.test(plane)) return "preview.localhost";
  return DEFAULT_PREVIEW_ZONE;
}

function sessionIdFromRest(rest: string): string | null {
  const zone = previewZone();
  const suffix = `.${zone}`;
  if (rest.endsWith(suffix)) {
    const id = rest.slice(0, -suffix.length);
    return id || null;
  }
  const marker = rest.indexOf(".preview.");
  if (marker > 0) {
    return rest.slice(0, marker);
  }
  return null;
}

export function parsePreviewHostname(
  hostHeader: string
): ParsedPreviewHost | null {
  const host = (hostHeader.split(":")[0] ?? "").toLowerCase();
  const extra = /^p(\d+)-s-(.+)$/.exec(host);
  if (extra?.[1] && extra[2]) {
    const sessionId = sessionIdFromRest(extra[2]);
    if (sessionId) {
      return { sessionId, port: Number(extra[1]) };
    }
  }
  const primary = /^s-(.+)$/.exec(host);
  if (primary?.[1]) {
    const sessionId = sessionIdFromRest(primary[1]);
    if (sessionId) {
      return { sessionId, port: null };
    }
  }
  return null;
}

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

export function previewUrl(hostname: string, scheme = "https"): string {
  const port = previewPublicPort();
  const defaultPort = scheme === "https" ? N_443 : N_80;
  if (port != null && port !== defaultPort) {
    return `${scheme}://${hostname}:${port}`;
  }
  return `${scheme}://${hostname}`;
}

export function stripBearer(
  authorization: string | undefined
): string | undefined {
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  return authorization.slice(BEARER_PREFIX.length);
}
