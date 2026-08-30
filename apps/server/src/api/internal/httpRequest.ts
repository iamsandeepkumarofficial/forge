const BLOCKED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "keep-alive"
]);

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export function parseHttpMethod(raw: unknown): HttpMethod | undefined {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  return HTTP_METHODS.find((m) => m === v);
}

export function joinAppRequestUrl(
  baseUrl: string,
  path: string
): string | undefined {
  const raw = path.trim() || "/";
  try {
    const base = new URL(baseUrl);
    if (/^https?:\/\//i.test(raw)) {
      const next = new URL(raw);
      return next.origin === base.origin ? next.href : undefined;
    }
    const pathname = raw.startsWith("/") ? raw : `/${raw}`;
    return new URL(pathname, base.origin).href;
  } catch {
    return undefined;
  }
}

export function appRequestBaseUrl(app: {
  url?: string;
  hostPort?: number;
}): string | undefined {
  if (app.hostPort != null) {
    return `http://127.0.0.1:${app.hostPort}`;
  }
  const url = app.url?.trim();
  return url || undefined;
}

export function sanitizeRequestHeaders(
  headers: unknown
): Record<string, string> {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.trim();
    if (!name || BLOCKED_HEADERS.has(name.toLowerCase())) continue;
    if (typeof value !== "string") continue;
    out[name] = value;
  }
  return out;
}

export function methodAllowsBody(method: HttpMethod): boolean {
  return !METHODS_WITHOUT_BODY.has(method);
}
