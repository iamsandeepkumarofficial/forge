export const API_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
] as const;

export const OPENAPI_SPEC_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/api-docs",
  "/v3/api-docs"
];

export type ApiOperation = {
  method: string;
  path: string;
  summary?: string;
};

export function previewPortLabel(app: {
  port?: number | null;
  name: string;
}): string {
  return app.port != null ? String(app.port) : app.name;
}

export function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function apiBaseUrl(app: {
  url?: string;
  hostPort?: number;
  port?: number | null;
}): string {
  if (app.url) return app.url;
  if (app.hostPort != null) return `http://127.0.0.1:${app.hostPort}`;
  if (app.port != null) return `localhost:${app.port}`;
  return "";
}

export function operationsFromOpenApi(spec: unknown): ApiOperation[] {
  if (!spec || typeof spec !== "object") return [];
  const paths = (spec as { paths?: unknown }).paths;
  if (!paths || typeof paths !== "object") return [];
  const out: ApiOperation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of API_METHODS) {
      const op = (item as Record<string, unknown>)[method.toLowerCase()];
      if (!op || typeof op !== "object") continue;
      const summary = (op as { summary?: unknown }).summary;
      out.push({
        method,
        path,
        summary: typeof summary === "string" ? summary : undefined
      });
    }
  }
  return out;
}

export function tryParseJsonBody(text: string): unknown | undefined {
  const raw = text.trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function formatResponseBody(body: string): string {
  const parsed = tryParseJsonBody(body);
  if (parsed === undefined) return body;
  return JSON.stringify(parsed, null, 2);
}

export function operationKey(op: ApiOperation): string {
  return `${op.method} ${op.path}`;
}

export function mergeOperations(
  ...groups: ApiOperation[][]
): ApiOperation[] {
  const found = new Map<string, ApiOperation>();
  for (const group of groups) {
    for (const op of group) {
      const key = operationKey(op);
      if (!found.has(key)) found.set(key, op);
    }
  }
  return [...found.values()].sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path)
  );
}
