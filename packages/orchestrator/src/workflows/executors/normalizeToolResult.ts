import { z } from "zod";

export function normalizeRawToolResult(raw: unknown): unknown {
  if (raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return raw;
  }
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null" ||
    /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed);
  if (!looksJson) {
    return raw;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return raw;
  }
}

export const toolResultDecoder = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.unknown());
