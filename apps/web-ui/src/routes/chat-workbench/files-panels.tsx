import { useState, useEffect, useCallback } from "react";
import { VirtualFileTree } from "../../components/virtual-file-tree.js";
import {
  executeTool,
  fetchFileDiff,
  listSandboxDir
} from "../../lib/tool-runner.js";
import { DiffText } from "../../components/tool-calls.js";
import type { FileTab, ViewerState } from "./types.js";

export { ChangesTab } from "./changes-tab.js";

export function FilesTab({
  sessionId,
  onOpen
}: {
  sessionId: string;
  onOpen: (path: string) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const getChildren = useCallback(
    (path: string) => listSandboxDir({ sessionId, path }),
    [sessionId]
  );
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-xs text-muted-foreground">Files</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-xs text-primary hover:underline"
        >
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 py-1">
        <VirtualFileTree
          getChildren={getChildren}
          onSelectFile={onOpen}
          resetKey={`${sessionId}:${refreshKey}`}
        />
      </div>
    </div>
  );
}

function ViewerPane({ viewer }: { viewer: ViewerState | null }) {
  if (!viewer) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Select a file from Files or Changes to view it here.
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] uppercase text-muted-foreground">
          {viewer.kind}
        </span>
        <span
          className="min-w-0 truncate font-mono text-xs"
          title={viewer.title}
        >
          {viewer.title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {viewer.loading ? (
          <p className="p-4 text-xs text-muted-foreground">Loading…</p>
        ) : viewer.error ? (
          <p className="p-4 text-xs text-destructive">{viewer.error}</p>
        ) : (
          <pre className="p-3 font-mono text-[0.7rem] whitespace-pre-wrap">
            {viewer.kind === "diff" ? (
              <DiffText text={viewer.content} />
            ) : (
              viewer.content
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

async function loadViewerContent(options: {
  sessionId: string;
  tab: FileTab;
}): Promise<ViewerState> {
  const { sessionId, tab } = options;
  if (tab.kind === "diff") {
    const text = await fetchFileDiff({
      sessionId,
      repo: tab.repo ?? "",
      filePath: tab.path
    });
    return {
      title: tab.path,
      kind: "diff",
      content: text,
      loading: false
    };
  }
  const res = await executeTool({
    sessionId,
    toolName: "read_file",
    args: { path: tab.path }
  });
  const nl = res.output.indexOf("\n");
  const content = nl >= 0 ? res.output.slice(nl + 1) : res.output;
  return {
    title: tab.path,
    kind: "file",
    content,
    loading: false,
    error: res.success ? undefined : res.output
  };
}

export function FileTabPane({
  sessionId,
  tab
}: {
  sessionId: string;
  tab: FileTab;
}) {
  const [viewer, setViewer] = useState<ViewerState>({
    title: tab.path,
    kind: tab.kind,
    content: "",
    loading: true
  });
  const [activeTabKey, setActiveTabKey] = useState(
    `${sessionId}:${tab.id}:${tab.kind}:${tab.path}:${tab.repo ?? ""}`
  );
  const nextTabKey = `${sessionId}:${tab.id}:${tab.kind}:${tab.path}:${tab.repo ?? ""}`;
  if (activeTabKey !== nextTabKey) {
    setActiveTabKey(nextTabKey);
    setViewer({ title: tab.path, kind: tab.kind, content: "", loading: true });
  }
  useEffect(() => {
    let cancelled = false;
    void loadViewerContent({ sessionId, tab })
      .then((next) => {
        if (!cancelled) setViewer(next);
      })
      .catch((e) => {
        if (!cancelled)
          setViewer({
            title: tab.path,
            kind: tab.kind,
            content: "",
            loading: false,
            error: e instanceof Error ? e.message : String(e)
          });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, tab]);
  return <ViewerPane viewer={viewer} />;
}
