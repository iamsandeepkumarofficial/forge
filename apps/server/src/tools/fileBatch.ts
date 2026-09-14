export const MAX_FILE_TOOL_BATCH = 20;

export type TouchedFileOp = "create" | "update" | "delete";

export type TouchedFile = {
  path: string;
  op: TouchedFileOp;
  before: string | null;
};

export type WriteFileEntry = { path: string; content: string };
export type EditFileEntry = {
  path: string;
  oldString: string;
  newString: string;
  replaceAll: boolean;
};
export type MoveFileEntry = { from: string; to: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function capped<T>(items: T[]): { items: T[]; error?: string } {
  if (items.length === 0) {
    return { items, error: "at least one file is required" };
  }
  if (items.length > MAX_FILE_TOOL_BATCH) {
    return {
      items,
      error: `at most ${MAX_FILE_TOOL_BATCH} files per call`
    };
  }
  return { items };
}

export function parseWriteFileArgs(args: Record<string, unknown>): {
  entries: WriteFileEntry[];
  error?: string;
} {
  if (Array.isArray(args.files)) {
    const entries: WriteFileEntry[] = [];
    for (const raw of args.files) {
      const rec = asRecord(raw);
      const path = typeof rec?.path === "string" ? rec.path.trim() : "";
      if (!path) continue;
      entries.push({
        path,
        content: typeof rec?.content === "string" ? rec.content : ""
      });
    }
    const cap = capped(entries);
    return { entries: cap.items, error: cap.error };
  }
  const path = typeof args.path === "string" ? args.path.trim() : "";
  if (!path) return { entries: [], error: "files is required" };
  return {
    entries: [
      { path, content: typeof args.content === "string" ? args.content : "" }
    ]
  };
}

export function parseEditFileArgs(args: Record<string, unknown>): {
  entries: EditFileEntry[];
  error?: string;
} {
  if (Array.isArray(args.files)) {
    const entries: EditFileEntry[] = [];
    for (const raw of args.files) {
      const rec = asRecord(raw);
      const path = typeof rec?.path === "string" ? rec.path.trim() : "";
      if (!path) continue;
      entries.push({
        path,
        oldString: typeof rec?.oldString === "string" ? rec.oldString : "",
        newString: typeof rec?.newString === "string" ? rec.newString : "",
        replaceAll: Boolean(rec?.replaceAll)
      });
    }
    const cap = capped(entries);
    return { entries: cap.items, error: cap.error };
  }
  const path = typeof args.path === "string" ? args.path.trim() : "";
  if (!path) return { entries: [], error: "files is required" };
  return {
    entries: [
      {
        path,
        oldString: typeof args.oldString === "string" ? args.oldString : "",
        newString: typeof args.newString === "string" ? args.newString : "",
        replaceAll: Boolean(args.replaceAll)
      }
    ]
  };
}

export function parseDeleteFilesArgs(args: Record<string, unknown>): {
  paths: string[];
  error?: string;
} {
  const raw = Array.isArray(args.paths)
    ? args.paths
    : typeof args.path === "string"
      ? [args.path]
      : [];
  const paths = raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean);
  const cap = capped(paths);
  return { paths: cap.items, error: cap.error };
}

export function parseMoveFilesArgs(args: Record<string, unknown>): {
  moves: MoveFileEntry[];
  error?: string;
} {
  if (Array.isArray(args.moves)) {
    const moves: MoveFileEntry[] = [];
    for (const raw of args.moves) {
      const rec = asRecord(raw);
      const from = typeof rec?.from === "string" ? rec.from.trim() : "";
      const to = typeof rec?.to === "string" ? rec.to.trim() : "";
      if (!from || !to) continue;
      moves.push({ from, to });
    }
    const cap = capped(moves);
    return { moves: cap.items, error: cap.error };
  }
  const from = typeof args.from === "string" ? args.from.trim() : "";
  const to = typeof args.to === "string" ? args.to.trim() : "";
  if (!from || !to) return { moves: [], error: "moves is required" };
  return { moves: [{ from, to }] };
}

export function parseTouchedFilesMetadata(raw: unknown): TouchedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: TouchedFile[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const path = typeof rec.path === "string" ? rec.path.trim() : "";
    const op = rec.op;
    if (!path) continue;
    if (op !== "create" && op !== "update" && op !== "delete") continue;
    const before =
      rec.before === null || typeof rec.before === "string" ? rec.before : null;
    out.push({ path, op, before });
  }
  return out;
}

export function applyExactReplace(options: {
  content: string;
  oldString: string;
  newString: string;
  replaceAll: boolean;
}): { updated: string } | { error: string } {
  if (options.replaceAll) {
    return {
      updated: options.content.split(options.oldString).join(options.newString)
    };
  }
  if (!options.content.includes(options.oldString)) {
    return { error: "Could not find the exact text to replace" };
  }
  return {
    updated: options.content.replace(options.oldString, options.newString)
  };
}

export function formatMutatingToolOutput(options: {
  verb: string;
  ok: string[];
  failed: string[];
}): string {
  const parts: string[] = [];
  if (options.ok.length > 0) {
    parts.push(`${options.verb} ${options.ok.join(", ")}`);
  }
  if (options.failed.length > 0) {
    parts.push(`Failed: ${options.failed.join("; ")}`);
  }
  return parts.join(". ") || "No files changed.";
}
