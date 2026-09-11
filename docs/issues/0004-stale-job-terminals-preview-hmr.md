# 0004: Stale job terminals, preview not auto-loading, Vite HMR dead

- **Status:** Fixed
- **Date:** 2026-09-11
- **Severity:** Confusing on chat revisit; preview looks broken until a manual refresh
- **Related:** [0002](./0002-stale-preview-across-sessions.md), [0003](./0003-preview-start-empty-terminal.md), [0008](./0008-ghost-preview-terminals-stop.md) (apps needed the same live restore gate)

## Summary

Reopening a workbench chat restored **finished** background job tabs (e.g. a completed `npm install`) next to the live server tab.

Separately, Electron preview often stayed blank until the user hit refresh/Go, and Vite HMR did not apply: the preview plane proxied HTTP but did not upgrade WebSockets to the app.

The right chat/preview split also jumped between idle and preview default widths because a stored user split was treated as an adaptive default.

## Repro

1. Start preview; let an install job finish; leave the live server tab open.
2. Visit another chat, then return — a second terminal for the finished job reappears.
3. Preview pane is empty until Refresh/Go; editing the app does not hot-reload.

## Fix

- **Jobs:** On history scan, `listTerminalJobs` and only re-track names that are still `running`. Finished jobs are untracked (`liveJobNames` in `use-track-background-jobs.ts` / `tracked-terminals.ts`).
- **Auto-load:** Queue Electron `loadURL` / blank / reload so a stale blank cannot clobber a newer URL (`electron-preview-ops.ts`).
- **HMR:** Preview-plane HTTP server handles `upgrade` and `proxy.ws` to the registered backend (`gateway.ts` / `app.ts`).
- **Split:** Ignore adaptive defaults when `localStorage` already has a user split (`workbench-split.ts`).

## Key files

| Area         | Path                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Job restore  | `apps/web-ui/src/routes/chat-workbench/use-track-background-jobs.ts` |
| Track filter | `apps/web-ui/src/routes/chat-workbench/tracked-terminals.ts`         |
| Load queue   | `apps/web-ui/src/routes/chat-workbench/electron-preview-ops.ts`      |
| WS upgrade   | `apps/preview-plane/src/gateway.ts`, `apps/preview-plane/src/app.ts` |
| Split        | `apps/web-ui/src/routes/chat-workbench/workbench-split.ts`           |

## Regression risks

- Re-tracking every historical `run_terminal` part on `historyLoaded` without checking `job.running`.
- HTTP-only preview proxy (Vite `/@vite/client` WS 404 → no HMR).
- Split effect that overwrites a stored percentage whenever `previewLive` flips.
