/**
 * Postgres `json`/`jsonb` reject U+0000 in string values
 * ("unsupported Unicode escape sequence"). Terminal/tool output often includes it.
 */
export function sanitizeJsonForPg<T>(value: T): T {
  if (typeof value === "string") {
    return (value.includes("\u0000") ? value.replaceAll("\u0000", "") : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForPg(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>
    )) {
      out[key] = sanitizeJsonForPg(nested);
    }
    return out as T;
  }
  return value;
}
