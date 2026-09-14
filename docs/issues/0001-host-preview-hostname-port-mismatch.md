# 0001: Host preview hostname vs listen port mismatch

- **Status:** Fixed
- **Date:** 2026-09-10
- **Severity:** Blocking for host-mode preview (apps appear running but preview opens the wrong host)
- **Related RFC:** [0009 SandboxRuntime Port Adapters](../rfcs/0009-sandbox-runtime-port-adapters.md), [0006 Local Host Runtime](../rfcs/0006-local-host-runtime-zero-docker.md)
- **Symptom surface:** Activity / Run UI shows `bp-frontend` running at `127.0.0.1:40007`, but preview / plane behavior still “points at 3000”; feels like preview state leaking across sessions.

## Summary

On **host** sessions, apps listen on session-registry ports (`40000–49999`). The host adapter correctly registered the preview-plane route on the **primary** hostname `s-<sessionId>…` → `127.0.0.1:<registryPort>`.

`statusForApp` rebuilt the URL the UI opens with a **different** hostname rule: only listen port `3000` was treated as primary; any other port became `p<port>-s-<sessionId>…`. For registry port `40007` that produced an **unregistered** hostname. The iframe/Electron view then 404’d or kept stale content, while `hostPort` correctly showed `40007`.

Workspace gateway registration made the “3000” story worse: it always upserted under `port: FIRST_APP_PORT` (3000), so the plane’s default hostname logic kept rewriting the primary `s-…` route as if it were the Docker 3000 slot.

This was **not** a cross-session route leak in `RouteStore` (routes are keyed by hostname, which embeds `sessionId`). It was publish vs status hostname disagreement after RFC 0009’s host listen ports.

## Observed behavior

1. Host workbench session, workspace with `bp-frontend` (and often `bp-backend`).
2. `preview_start` succeeds; status / Activity shows something like:
   - `bp-frontend/bp-frontend`
   - `running · 127.0.0.1:40007`
3. Opening preview does not reliably show that process:
   - wrong / missing preview hostname, or
   - Electron still showing a previous page that looked like a `:3000` app.
4. Easy misread: “preview plane is leaking session A into session B” or “everything still points at 3000.”

## Root cause (step by step)

### 1. Host listen port is a registry port

Host `SandboxRuntime.resolveListenPort` allocates from `sessionPortRegistry` (`40000–49999`), persists it as `app.port`, and injects `PORT=<that>`. The process binds `127.0.0.1:40007` (example). Docker’s reserved range `3000–3009` is **not** the host listen model ([RFC 0009](../rfcs/0009-sandbox-runtime-port-adapters.md)).

### 2. Publish registers the correct primary host

`hostPublishPreviewPort` treated the **lowest allocated registry port** for the session as primary:

- Primary → hostname `s-<sessionId>.<previewBaseDomain>`
- Otherwise → `p<listenPort>-s-<sessionId>.<previewBaseDomain>`
- `backendService` → `127.0.0.1:<listenPort>`

So for the first (or only) app on `40007`, the plane correctly stored:

`s-abc….preview.localhost` → `127.0.0.1:40007`.

### 3. Status rebuilt a different hostname

`previewUrlIfConfigured` / `resolveRunningAppUrl` used Docker-era logic:

```text
listenPort === 3000  →  s-<session>…
otherwise            →  p<listenPort>-s-<session>…
```

For `app.port === 40007` the UI URL became:

`http://p40007-s-abc….preview.localhost:8081`

That hostname was **never registered**.

### 4. UI opens status URL, not the registered host

Preview iframe / Electron `loadURL` uses `app.url` from status. Plane gateway looks up by hostname → miss → `preview_not_found` / upstream failure. Electron often left the **previous** WebContents page visible, which looked like session/port leakage.

Meanwhile `hostPort` came from `resolvePublishedPort` (identity on host) → Activity correctly showed `127.0.0.1:40007`.

### 5. Workspace gateway reinforced “port 3000”

`registerWorkspaceGateway` called `registerPreviewRoute` with:

- `port: FIRST_APP_PORT` (**always 3000**)
- no explicit `hostname`
- `backendService` / `pathRoutes` pointing at real `127.0.0.1:<hostPort>` values

Preview-plane `defaultHostname` then treated `port === 3000` as primary `s-<session>…` and **upserted** that hostname. Metadata on the route said port `3000` while backends were 40xxx — confusing in logs and tools, and fighting host publish’s port field.

## Fix

### Adapter-owned hostname

Added `SandboxRuntime.previewHostname(sessionId, listenPort)`:

| Runtime      | Primary hostname when                                        |
| ------------ | ------------------------------------------------------------ |
| Host         | `listenPort` is the session’s lowest allocated registry port |
| Docker / K8s | `listenPort === 3000` (`FIRST_APP_PORT`)                     |

Shared helpers: `apps/server/src/projects/sandboxRuntime/previewHostname.ts`.  
`publishPreviewPort` and status both use the same helper so register and open URLs cannot diverge.

### Status URLs

`resolveRunningAppUrl` takes an explicit `previewHostname` from the session runtime (no more hardcoded `port === 3000` primary in status). If plane env is unset, fall back to `http://127.0.0.1:${hostPort}`.

### Workspace gateway

`registerWorkspaceGateway` now:

1. Maps repos → listen port and published host port from running apps.
2. Builds path routes as before (`127.0.0.1:${hostPort}`).
3. Registers with the catch-all app’s **real listen port** and `runtime.previewHostname(sessionId, primaryListen)` — never hardcoded `3000` on host.

### UI / Electron hardening

- Run sidebar and `previewPortLabel` prefer `hostPort` when present (show `40007`, not a misleading listen-slot label).
- Electron preview: clear / hide when URL is empty so a failed new session does not keep painting the previous session’s page (`use-electron-preview.ts`).

## Key files

| Area                      | Path                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| Hostname helpers          | `apps/server/src/projects/sandboxRuntime/previewHostname.ts`                      |
| Host publish              | `apps/server/src/projects/sandboxRuntime/hostAdapter.ts`                          |
| Docker / K8s publish      | `dockerAdapter.ts`, `k8sAdapter.ts`                                               |
| Status URL + gateway      | `apps/server/src/projects/appRunner/status.ts`                                    |
| URL unit tests            | `apps/server/src/projects/appRunner.url.test.ts`, `previewHostname.test.ts`       |
| UI port label             | `apps/web-ui/src/routes/chat-workbench/api-explorer-model.ts`, `run-sidebar.tsx`  |
| Electron stale page       | `apps/web-ui/src/routes/chat-workbench/use-electron-preview.ts`                   |
| Plane store (not the bug) | `apps/preview-plane/src/routeStore.ts` (keyed by hostname; sessionId in hostname) |

## Verification

1. Host session; start a web app via `preview_start`.
2. Confirm listen / `hostPort` is in `40000–49999`.
3. Confirm plane registration hostname equals `app.url` host (primary `s-…` for the first registry port, not `p40007-s-…` unless a second app is non-primary).
4. Open preview → serves that process on the registry port.
5. Switch sessions → old Electron page does not stick when the new URL is empty/cleared; new session registers under its own `s-<newSession>…`.

## Regression risks

- Anything that rebuilds preview URLs with `port === 3000` as the only primary rule.
- Gateway or tooling that registers plane routes with `port: 3000` and relies on `defaultHostname` without passing `hostname` from the adapter.
- UI that displays `app.port` instead of `hostPort` on Docker (listen 3000 vs published 40xxx) and confuses operators again.

## Related fixes in the same thread (not this issue’s core)

These landed alongside the port/preview work and are easy to conflate:

1. **Host readiness probed Docker-mapped ports** — app listened on `3000`, readiness hit `41xxx`, Forge SIGTERM’d a healthy process. Fixed by adapter `resolvePublishedPort` / `ensurePublishedPortReady` ([RFC 0009](../rfcs/0009-sandbox-runtime-port-adapters.md)).
2. **`run_terminal` login shell PATH** — `sh -lc` re-sourced Homebrew Node 26 over forge-managed Node 20; switched to `sh -c`.
3. **Leave-session dialog under Electron BrowserView** — DOM `z-index` cannot cover native preview; portal + `preview-overlay-lock` hides the BrowserView while the modal is open.
