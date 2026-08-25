export type FileChangeKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "other";
export interface SessionFileChange {
  path: string;
  status: string;
  kind: FileChangeKind;
}
export interface SessionRepoChanges {
  repo: string;
  worktreePath: string;
  files: SessionFileChange[];
  error?: string;
}
function classifyPorcelain(xy: string): FileChangeKind {
  const x = xy[0] ?? " ";
  const y = xy[1] ?? " ";
  if (x === "?" && y === "?") {
    return "untracked";
  }
  if (x === "A" || y === "A") {
    return "added";
  }
  if (x === "D" || y === "D") {
    return "deleted";
  }
  if (x === "R" || y === "R" || x === "C" || y === "C") {
    return "renamed";
  }
  if (x === "M" || y === "M") {
    return "modified";
  }
  if (x !== " " || y !== " ") {
    return "modified";
  }
  return "other";
}
export function parsePorcelain(stdout: string): SessionFileChange[] {
  const minPorcelainLineLength = 4;
  const pathStartIndex = 3;
  const lines = stdout.split(/\r?\n/).filter((l) => l.length > 0);
  const out: SessionFileChange[] = [];
  for (const line of lines) {
    if (line.length < minPorcelainLineLength) {
      continue;
    }
    const raw = line.slice(0, 2);
    const rest = line.slice(pathStartIndex).trim();
    let filePath = rest;
    if (rest.includes(" -> ")) {
      const parts = rest.split(" -> ");
      filePath = parts[parts.length - 1]!.trim();
    }
    if (!filePath) {
      continue;
    }
    const kind = classifyPorcelain(raw);
    out.push({ path: filePath.replace(/\\/g, "/"), status: raw, kind });
  }
  return out;
}
