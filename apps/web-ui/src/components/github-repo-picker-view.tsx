import { Loader2, Lock, Search } from "lucide-react";
import type { GithubRepoSummary } from "../lib/github-api.js";

type PickerState = {
  title: string;
  statusLogin: string | null;
  configured: boolean;
  error: string | null;
  busy: boolean;
  authorizing: boolean;
  query: string;
  setQuery: (v: string) => void;
  repos: GithubRepoSummary[];
  loading: boolean;
  hasMore: boolean;
  page: number;
  authorize: () => void;
  loadRepos: (page: number, replace: boolean) => void;
  disconnect: () => void;
};

export function GithubRepoPickerView(options: {
  state: PickerState;
  onClose: () => void;
  onSelect: (fullName: string) => void | Promise<void>;
  connectingSlug?: string | null;
}) {
  const { state: s, onClose, onSelect, connectingSlug } = options;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{s.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.statusLogin
                ? `Signed in as @${s.statusLogin}`
                : "Authorize Forge to list repositories from your GitHub account."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            disabled={Boolean(connectingSlug)}
          >
            Close
          </button>
        </div>
        {s.error && (
          <p className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {s.error}
          </p>
        )}
        {!s.configured ? null : !s.statusLogin ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10">
            <button
              type="button"
              disabled={s.busy}
              onClick={s.authorize}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {s.authorizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {s.authorizing ? "Waiting for GitHub…" : "Authorize with GitHub"}
            </button>
          </div>
        ) : (
          <GithubRepoList
            state={s}
            onSelect={onSelect}
            connectingSlug={connectingSlug}
          />
        )}
      </div>
    </div>
  );
}

function GithubRepoList(options: {
  state: PickerState;
  onSelect: (fullName: string) => void | Promise<void>;
  connectingSlug?: string | null;
}) {
  const { state: s, onSelect, connectingSlug } = options;
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            placeholder="Search your repositories…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            disabled={s.busy}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            disabled={s.busy}
            onClick={s.disconnect}
          >
            Disconnect GitHub
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {s.loading && s.repos.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading repositories…
          </div>
        ) : s.repos.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            No repositories found.
          </p>
        ) : (
          <RepoRows
            repos={s.repos}
            busy={s.busy}
            connectingSlug={connectingSlug}
            onSelect={onSelect}
          />
        )}
      </div>
      {s.hasMore ? (
        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={s.busy}
            onClick={() => s.loadRepos(s.page + 1, false)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {s.loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function RepoRows(options: {
  repos: GithubRepoSummary[];
  busy: boolean;
  connectingSlug?: string | null;
  onSelect: (fullName: string) => void | Promise<void>;
}) {
  const { repos, busy, connectingSlug, onSelect } = options;
  return (
    <ul className="space-y-1">
      {repos.map((repo) => {
        const connecting = connectingSlug === repo.fullName;
        return (
          <li key={repo.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSelect(repo.fullName)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{repo.fullName}</span>
                  {repo.private ? (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                {repo.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {repo.description}
                  </p>
                ) : null}
              </div>
              {connecting ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
