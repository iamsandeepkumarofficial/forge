# 0002: Stale preview from another session on workbench load

- **Status:** Fixed
- **Date:** 2026-09-10
- **Severity:** Confusing / looks like session leak; related to [0001](./0001-host-preview-hostname-port-mismatch.md)
- **Symptom:** Opening a session (with **no** preview started) briefly shows another session’s web preview in the Electron BrowserView, then clears to empty.

## Summary

Two cooperating bugs:

1. **`useApps` did not reset on `sessionId` change.** Until `fetchApps` returned, React kept the previous session’s `apps` (including `running` + `url`). The preview stage therefore mounted `ElectronPreviewHole` with the **old** URL for a frame or more.
2. **Electron preview is a process-wide native view.** Hiding it without loading `about:blank` left the previous document in the WebContents. On the next show (or during the stale-apps flash), that document painted again.

Not a preview-plane cross-session hostname collision; the plane was serving whatever URL the UI asked for (the previous session’s URL still held in React state).

## Repro

1. Session A: start a web app; leave preview open (EazyLocale / any page).
2. Navigate to Session B that has **no** running preview / empty launch apps.
3. For a short moment, Session A’s page appears in the preview pane, then empty state.

## Root cause

```text
Session A apps=[{ url: http://s-A… }]  →  BrowserView loads A, visible
Navigate to Session B
useApps still has A’s apps until fetch completes
WebPreviewContent sees appUrl → mounts hole with A’s URL
BrowserView shows A again (or never fully cleared)
fetchApps(B) returns [] → empty state; hole unmounts
```

## Fix

1. **`useApps`:** On `sessionId` change, synchronously clear to `{ apps: [] }` (same render-phase reset pattern as the workbench chat loader). Ignore late `fetchApps` responses for a superseded session id.
2. **`useElectronPreviewPage`:** When URL is empty **or** the hook unmounts, `setVisible(false)` and `loadURL("about:blank")` so native WebContents does not retain the prior document.
3. **`PreviewHost.loadURL`:** Always allow `about:blank` (do not skip via `sameLoadedUrl`).

## Key files

| Area                   | Path                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Apps poll reset        | `apps/web-ui/src/routes/chat-workbench/use-apps.ts`             |
| Blank on clear/unmount | `apps/web-ui/src/routes/chat-workbench/use-electron-preview.ts` |
| about:blank load       | `apps/electron/src/previewHost.ts`                              |

## Verification

1. Session A with live preview → switch to Session B with no apps.
2. Preview pane should go straight to empty (“No preview yet”); no flash of A’s page.
3. Start preview on B → only B’s app appears.

## Related

- [0001](./0001-host-preview-hostname-port-mismatch.md) — wrong hostname made failed loads leave Electron on an old page more often.
- Exit-session overlay lock — also hides BrowserView, but does not clear document; blanking on session change covers the load flash.
