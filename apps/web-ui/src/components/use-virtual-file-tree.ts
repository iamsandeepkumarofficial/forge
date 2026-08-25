import { useCallback, useEffect, useMemo, useState } from "react";
import type { GetChildren, TreeEntry } from "./virtual-file-tree-types.js";
import { buildTreeRows } from "./virtual-file-tree-rows.js";

type TreeMaps = {
  resetKey: string;
  getChildren: GetChildren;
  cache: Map<string, TreeEntry[]>;
  loading: Set<string>;
  errored: Set<string>;
};

function emptyMaps(resetKey: string, getChildren: GetChildren): TreeMaps {
  return {
    resetKey,
    getChildren,
    cache: new Map(),
    loading: new Set(),
    errored: new Set()
  };
}

function markLoading(prev: TreeMaps, path: string): TreeMaps {
  if (prev.loading.has(path)) return prev;
  return { ...prev, loading: new Set(prev.loading).add(path) };
}

function markLoaded(options: {
  prev: TreeMaps;
  path: string;
  entries: TreeEntry[];
}): TreeMaps {
  const { prev, path, entries } = options;
  const nextErrored = new Set(prev.errored);
  nextErrored.delete(path);
  const nextLoading = new Set(prev.loading);
  nextLoading.delete(path);
  return {
    ...prev,
    cache: new Map(prev.cache).set(path, entries),
    errored: nextErrored,
    loading: nextLoading
  };
}

function markErrored(prev: TreeMaps, path: string): TreeMaps {
  const nextLoading = new Set(prev.loading);
  nextLoading.delete(path);
  return {
    ...prev,
    errored: new Set(prev.errored).add(path),
    loading: nextLoading
  };
}

export function useVirtualFileTree(options: {
  getChildren: GetChildren;
  defaultExpanded: boolean;
  resetKey: string;
}) {
  const { getChildren, defaultExpanded, resetKey } = options;
  const [maps, setMaps] = useState(() => emptyMaps(resetKey, getChildren));
  if (maps.resetKey !== resetKey || maps.getChildren !== getChildren) {
    setMaps(emptyMaps(resetKey, getChildren));
  }
  const { cache, loading, errored } = maps;
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const isExpanded = useCallback(
    (path: string) =>
      path === ""
        ? true
        : defaultExpanded
          ? !toggled.has(path)
          : toggled.has(path),
    [defaultExpanded, toggled]
  );
  const requestChildren = useCallback(
    (path: string) => {
      setMaps((prev) => markLoading(prev, path));
      void getChildren(path)
        .then((entries) =>
          setMaps((prev) => markLoaded({ prev, path, entries }))
        )
        .catch(() => setMaps((prev) => markErrored(prev, path)));
    },
    [getChildren]
  );
  const { rows, pending } = useMemo(
    () => buildTreeRows({ cache, loading, errored, isExpanded }),
    [cache, loading, errored, isExpanded]
  );
  const pendingKey = pending.join("|");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      for (const p of pending) requestChildren(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingKey, pending, requestChildren]);
  const toggle = (path: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  return { rows, isExpanded, toggle };
}
