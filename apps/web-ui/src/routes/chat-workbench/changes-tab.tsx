import { useMemo } from "react";
import {
  VirtualFileTree,
  eagerChildrenFromPaths
} from "../../components/virtual-file-tree.js";
import {
  fetchSessionChanges,
  type SessionRepoChanges
} from "../../lib/tool-runner.js";
import { useEffect, useState } from "react";

const N_2800 = 2800;

function kindColor(kind: SessionRepoChanges["files"][number]["kind"]): string {
  switch (kind) {
    case "added":
      return "text-green-600";
    case "deleted":
      return "text-destructive";
    case "untracked":
      return "text-muted-foreground";
    default:
      return "text-amber-600";
  }
}

export function ChangesTab(options: {
  sessionId: string;
  onRepo: (repo: string) => void;
  onOpen: (repo: string, path: string) => void;
}) {
  const { sessionId, onRepo, onOpen } = options;
  const [repos, setRepos] = useState<SessionRepoChanges[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetchSessionChanges(sessionId).then(
        (data) => {
          if (cancelled) return;
          setRepos(data.repos);
          setError(null);
          if (data.repos[0]?.repo) onRepo(data.repos[0].repo);
        },
        (e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      );
    };
    tick();
    const id = window.setInterval(tick, N_2800);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, onRepo]);
  const r = repos[0];
  const getChildren = useMemo(
    () =>
      eagerChildrenFromPaths(
        (r?.files ?? []).map((f) => ({ path: f.path, meta: f }))
      ),
    [r?.files]
  );
  const resetKey = useMemo(
    () => (r?.files ?? []).map((f) => `${f.status}:${f.path}`).join("|"),
    [r?.files]
  );
  if (error) return <p className="p-3 text-xs text-destructive">{error}</p>;
  if (!r) {
    return (
      <p className="p-3 text-xs text-muted-foreground">Loading changes…</p>
    );
  }
  return (
    <ChangesTabBody
      repo={r}
      getChildren={getChildren}
      resetKey={resetKey}
      onOpen={onOpen}
    />
  );
}

function ChangesTabBody(options: {
  repo: SessionRepoChanges;
  getChildren: ReturnType<typeof eagerChildrenFromPaths>;
  resetKey: string;
  onOpen: (repo: string, path: string) => void;
}) {
  const { repo: r, getChildren, resetKey, onOpen } = options;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-muted px-3 py-1 font-mono text-[0.7rem] font-semibold">
        {r.repo}
      </div>
      {r.error ? (
        <p className="px-3 py-2 text-[0.7rem] text-destructive">{r.error}</p>
      ) : r.files.length === 0 ? (
        <p className="px-3 py-2 text-[0.7rem] text-muted-foreground">
          Clean — no changes.
        </p>
      ) : (
        <div className="min-h-0 flex-1 py-1">
          <VirtualFileTree
            getChildren={getChildren}
            onSelectFile={(path) => onOpen(r.repo, path)}
            defaultExpanded
            resetKey={resetKey}
            renderMeta={(meta) => {
              const f = meta as SessionRepoChanges["files"][number] | undefined;
              if (!f) return null;
              return (
                <span
                  className={`shrink-0 font-mono text-[0.6rem] uppercase ${kindColor(f.kind)}`}
                >
                  {f.kind.slice(0, 3)}
                </span>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
