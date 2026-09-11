# 0008: Ghost preview terminals after branch; Stop blanks preview but leaves processes

- **Status:** Fixed
- **Date:** 2026-09-11
- **Severity:** Forked workbench looks like two apps are running when Run is empty; Stop looks like it worked (preview blanks) while Vite/npm children can keep listening
- **Related:** [0004](./0004-stale-job-terminals-preview-hmr.md) (jobs already had a live restore gate; apps did not), [RFC 0010](../rfcs/0010-interactive-chat-revert.md) (branch does not clone processes)

## Summary

Two cooperating bugs around `preview_start` liveness:

1. **Ghost terminals on branch.** Branch copies live messages, including `preview_start` tool parts, but not PID files, `.forge-runtime`, or running processes. On load, the composer **“N terminals running”** bar and dock app tabs hydrated those parts as live. The Run tab / preview poll real PIDs in the new sandbox and correctly showed nothing.
2. **Stop deleted the PID, not the tree.** Clicking Stop called `stopApp` → `stopBackgroundJob`, which `kill`s the wrapper PID then **always** removes the pidfile. `running` is pidfile + `kill -0` only, so the next `useApps` poll blanks the preview. On host, the job is often not the process-group leader (`sandbox-exec` is), so npm/Vite children survive. The terminals bar also never `untrackApp`’d, so it still said they were running until refresh — and history then restored the ghosts again (bug 1).

Branch chat not cloning preview is an accepted non-goal. The child must not _look_ like the parent’s apps are still up.

## Repro

1. Workbench A: agent `preview_start` two apps. Run tab green; composer shows “2 terminals running”; preview iframes live.
2. Branch from an assistant message → workbench B. B’s Run tab is empty, but the terminals bar / dock still shows two running apps.
3. Back on A, click Stop (terminals bar or Run). Preview goes blank. After refresh, Run/preview stay empty (pidfile gone) even if the port is still held; without the live-app gate the terminals bar also comes back from history.

## Fix

- **Apps:** Same restore gate as jobs. History scan `fetchApps` and only re-track names that are still `running` (`liveAppNames` in `use-track-background-jobs.ts` / `tracked-terminals.ts`). Live `preview_start` tool parts still track immediately (`openTabs`, no live set) so Vite boot tabs are unchanged ([0003](./0003-preview-start-empty-terminal.md)).
- **Stop kill:** `stopJobScript` signals the process group and `pkill -P` children, and reports whether a pidfile existed. `stopApp` then `freeListeningPort` only when this session had a PID or a live job — so a ghost Stop on a child cannot kill the parent’s port.
- **Stop UI:** Run sidebar and terminals bar `untrackApp` / `untrackBackgroundJob` after a successful stop so the count drops immediately. Failed stop leaves the row tracked.

## Key files

| Area         | Path                                                                 |
| ------------ | -------------------------------------------------------------------- |
| App restore  | `apps/web-ui/src/routes/chat-workbench/use-track-background-jobs.ts` |
| Track filter | `apps/web-ui/src/routes/chat-workbench/tracked-terminals.ts`         |
| Stop UI      | `apps/web-ui/src/routes/chat-workbench/running-terminals-bar.tsx`    |
| Run stop     | `apps/web-ui/src/routes/chat-workbench/run-sidebar.tsx`              |
| Kill + port  | `apps/server/src/projects/backgroundJob.ts`, `appRunner/status.ts`   |

## Regression risks

- Restoring historical `preview_start` parts on `historyLoaded` without checking `app.running` (forked chats show ghost terminals).
- `stopApp` calling `freeListeningPort` when this session never had a pidfile (child Stop would kill whatever is on the copied `launch.json` port).
- Untracking on Stop _before_ the API succeeds (failed stop hides a still-running app).
- Treating “not running yet” as historical (pass `liveAppNames` on live tool parts — drops the boot tab).
