# Tech debt

Known follow-ups that are intentionally not in the current work. For product ideas that are not bugs, see [upcoming-features.md](./upcoming-features.md). For QA notes, see [qa-backlog.md](./qa-backlog.md).

## Branch chat does not clone preview or terminals

**Status:** accepted non-goal — [RFC 0010](./rfcs/0010-interactive-chat-revert.md)

Branch copies live messages through the forked assistant turn, copy-on-write clones the parent working tree (including install/build dirs; skip only `.git` / `.forge-runtime`), restores files touched after that turn, and remaps checkpoint blobs so Undo works on the child. The child still boots its own preview, terminals, and env. Untracked shell mutations (`sed -i`, redirects) stay out of the sidecar. Docker clones without host worktrees use a full tar overlay (not reflink).

## Background jobs are hardcoded shell scripts, not a process manager

**Status:** open — 2026-09-11

**Problem:** Start/stop for `run_terminal` and preview apps is a pile of inline `sh -c` strings in [`backgroundJob.ts`](../apps/server/src/projects/backgroundJob.ts) and [`backgroundJobPid.ts`](../apps/server/src/projects/backgroundJobPid.ts): `echo $$` into a pidfile, `setsid`, `kill -$P`, `pkill -P`, `/proc` inode walks, host `lsof`. Docker vs host vs `sandbox-exec` each need a different wrapper. The Stop bugs in [issue 0008](./issues/0008-ghost-preview-terminals-stop.md) were this model (pidfile was the inner shell, not the process-group leader).

**Follow-up:** Replace with a real process manager (or a small supervisor): start with a known PGID, logs, and stop-the-tree as first-class operations. Keep `launch.json` as the catalog; stop embedding kill scripts in TypeScript strings.

**Related:** issue 0008, `backgroundJob.ts`, `backgroundJobPid.ts`, `hostAdapter.ts`.
