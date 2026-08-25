import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  N_12,
  N_14,
  N_400,
  OVERSCAN,
  ROW_H,
  type GetChildren,
  type Row,
  type TreeEntry,
  type VirtualFileTreeProps
} from "./virtual-file-tree-types.js";
import { useVirtualFileTree } from "./use-virtual-file-tree.js";

export type { TreeEntry, GetChildren } from "./virtual-file-tree-types.js";

function TreeRows(options: {
  visible: Row[];
  start: number;
  isExpanded: (path: string) => boolean;
  toggle: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  renderMeta?: (meta: unknown) => ReactNode;
}) {
  const o = options;
  return (
    <>
      {o.visible.map((row, i) => (
        <TreeRowItem
          key={row.key}
          row={row}
          index={o.start + i}
          isExpanded={o.isExpanded}
          toggle={o.toggle}
          onSelectFile={o.onSelectFile}
          selectedPath={o.selectedPath}
          renderMeta={o.renderMeta}
        />
      ))}
    </>
  );
}

function TreeRowItem(options: {
  row: Row;
  index: number;
  isExpanded: (path: string) => boolean;
  toggle: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  renderMeta?: (meta: unknown) => ReactNode;
}) {
  const {
    row,
    index,
    isExpanded,
    toggle,
    onSelectFile,
    selectedPath,
    renderMeta
  } = options;
  const pad = row.depth * N_12 + 4;
  const style = {
    position: "absolute" as const,
    top: index * ROW_H,
    height: ROW_H,
    left: 0,
    right: 0,
    paddingLeft: pad
  };
  if (row.state === "loading") {
    return (
      <div
        style={style}
        className="flex items-center text-[0.7rem] text-muted-foreground"
      >
        Loading…
      </div>
    );
  }
  if (row.state === "error") {
    return (
      <div
        style={style}
        className="flex items-center text-[0.7rem] text-destructive"
      >
        Failed to load
      </div>
    );
  }
  if (row.isDir) {
    const expanded = isExpanded(row.path);
    return (
      <button
        type="button"
        style={style}
        onClick={() => toggle(row.path)}
        className="flex items-center gap-1 text-left text-[0.7rem] hover:bg-muted"
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-medium text-foreground">{row.name}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelectFile(row.path)}
      className={`flex items-center gap-1.5 pr-2 text-left font-mono text-[0.7rem] hover:bg-muted ${selectedPath === row.path ? "bg-accent" : ""}`}
      title={row.path}
      style={{ ...style, paddingLeft: pad + N_14 }}
    >
      <span className="min-w-0 flex-1 truncate">{row.name}</span>
      {renderMeta?.(row.meta)}
    </button>
  );
}

export function VirtualFileTree({
  getChildren,
  onSelectFile,
  selectedPath,
  renderMeta,
  defaultExpanded = false,
  resetKey = ""
}: VirtualFileTreeProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(N_400);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { rows, isExpanded, toggle } = useVirtualFileTree({
    getChildren,
    defaultExpanded,
    resetKey
  });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const total = rows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(
    total,
    Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN
  );
  const visible = rows.slice(start, end);
  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="h-full overflow-auto"
    >
      <div style={{ height: total * ROW_H, position: "relative" }}>
        <TreeRows
          visible={visible}
          start={start}
          isExpanded={isExpanded}
          toggle={toggle}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
          renderMeta={renderMeta}
        />
      </div>
    </div>
  );
}

export function eagerChildrenFromPaths(
  items: {
    path: string;
    meta?: unknown;
  }[]
): GetChildren {
  const map = new Map<string, TreeEntry[]>();
  const ensure = (p: string) => {
    let arr = map.get(p);
    if (!arr) {
      arr = [];
      map.set(p, arr);
    }
    return arr;
  };
  ensure("");
  for (const item of items) {
    const segs = item.path.split("/").filter(Boolean);
    if (segs.length === 0) continue;
    for (let i = 0; i < segs.length - 1; i++) {
      const parent = segs.slice(0, i).join("/");
      const dirPath = segs.slice(0, i + 1).join("/");
      const arr = ensure(parent);
      if (!arr.some((e) => e.path === dirPath)) {
        arr.push({ name: segs[i]!, path: dirPath, isDir: true });
      }
      ensure(dirPath);
    }
    const fileParent = segs.slice(0, -1).join("/");
    ensure(fileParent).push({
      name: segs[segs.length - 1]!,
      path: item.path,
      isDir: false,
      meta: item.meta
    });
  }
  for (const arr of map.values()) {
    arr.sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
    );
  }
  return (path: string) => Promise.resolve(map.get(path) ?? []);
}
