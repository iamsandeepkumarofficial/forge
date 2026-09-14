# 0003: `preview_start` terminal stuck empty / tails the wrong log

- **Status:** Fixed
- **Date:** 2026-09-11
- **Severity:** Preview tabs look dead while the app is actually running
- **Symptom surface:** Dock terminal opens on `preview_start` and stays on “Waiting for output…”, or shows a staircase of unreadable lines. Workspace apps (e.g. `bp-backend`) are the worst.

## Summary

Three cooperating bugs:

1. **Subscribe-before-process.** The UI opened an `app:<name>` log follow as soon as the live tool part had a name. The follower treated “not running yet” as exited and stopped, so the tab never saw later output.
2. **Stream name mismatch.** Tool args often used a short name (`bp-backend`) while logs were written under the canonical launch name (`bp-backend/bp-backend`). The tab tailed the wrong file.
3. **LF without CR.** Read-only xterm panes wrote `\n` only, so each log line stepped right (staircase).

## Repro

1. Host or Docker workbench; `preview_start` a workspace app (especially a non-frontend member).
2. Dock terminal opens immediately with “Waiting for output…”.
3. Process is running (Run sidebar / `hostPort` healthy) but the tab stays empty, or fills with staggered lines.

## Fix

- **Follow:** `nextLogFollowPoll` requires `seenRunning` (plus a start-wait / restart grace) before treating a missing process as exited (`sessionAppLog.ts`).
- **Name:** `resolveAppLogStreamName` maps the requested name through `matchLaunchApp`. The UI rebinds the tab to `metadata.app.name` when the tool result arrives.
- **EOL:** read-only xterm helpers convert LF → CRLF (`convertEol` / write path in `terminal-xterm-helpers.ts`).

## Key files

| Area           | Path                                                              |
| -------------- | ----------------------------------------------------------------- |
| Follow poll    | `apps/server/src/projects/sessionAppLog.ts`                       |
| Stream name    | `apps/server/src/projects/appLogStreamName.ts`                    |
| Track / rebind | `apps/web-ui/src/routes/chat-workbench/tracked-terminals.ts`      |
| CRLF           | `apps/web-ui/src/routes/chat-workbench/terminal-xterm-helpers.ts` |

## Regression risks

- Opening an app log tab from tool args _before_ `tool_result` without rebinding the canonical name.
- Treating “not running” as exited on the first poll (kills Vite/next boot).
- Writing `\n` into xterm without `convertEol`.
