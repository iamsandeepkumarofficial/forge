import type { Row, TreeEntry } from "./virtual-file-tree-types.js";

export function buildTreeRows(options: {
  cache: Map<string, TreeEntry[]>;
  loading: Set<string>;
  errored: Set<string>;
  isExpanded: (path: string) => boolean;
}): { rows: Row[]; pending: string[] } {
  const { cache, loading, errored, isExpanded } = options;
  const out: Row[] = [];
  const need: string[] = [];
  const walk = (path: string, depth: number) => {
    const kids = cache.get(path);
    if (!kids) {
      if (!loading.has(path)) need.push(path);
      out.push({
        key: `${path}#loading`,
        name: "Loading…",
        path,
        depth,
        isDir: false,
        state: "loading"
      });
      return;
    }
    for (const e of kids) {
      out.push({
        key: e.path,
        name: e.name,
        path: e.path,
        depth,
        isDir: e.isDir,
        meta: e.meta,
        state: "ok"
      });
      if (e.isDir && isExpanded(e.path)) {
        if (errored.has(e.path)) {
          out.push({
            key: `${e.path}#err`,
            name: "Failed to load",
            path: e.path,
            depth: depth + 1,
            isDir: false,
            state: "error"
          });
        } else {
          walk(e.path, depth + 1);
        }
      }
    }
  };
  walk("", 0);
  return { rows: out, pending: need };
}
