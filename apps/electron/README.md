# Forge desktop (Electron)

Chromium supervisor for local Forge. Catalog infra is always native Postgres 16 + Temporal CLI under `~/.forge/` (no Docker required). Per chat, pick **Normal** (local host sandbox) or **Cloud** (Docker sandbox; needs a running Docker daemon).

## Dev

If Electron fails to launch (`path.txt` missing, or `Library not loaded: Electron Framework`), the npm installer often leaves a stub `.app` (Node’s `extract-zip` on newer Node). `pnpm install` and `pnpm desktop` run `scripts/ensure-electron.mjs`, which checks for `Electron Framework` and falls back to system `unzip` of the cached zip. You can also run `pnpm --filter @forge/electron run postinstall`.

Needs `postgres`/`initdb` (PG 16) and `temporal` on `PATH`, or binaries in `~/.forge/runtime/bin/`.

From the repo root:

```bash
pnpm desktop
```

This compiles the main/preload processes, opens an Electron window on `http://127.0.0.1:5173`, starts Vite if that port is down, and runs `startInfra` (native stack + Node processes). Preview reverse-proxy stays **in-process** on the tool plane (`*.preview.localhost:8081`).

The preview pane is a `WebContentsView` (real Chromium document, not an iframe). The dock **DevTools** tab embeds the official DevTools frontend for that same view (`setDevToolsWebContents`). Browser-only `pnpm dev` keeps the iframe + facsimile inspector.

## Browser fallback

Browser contrib without Electron still needs a running Postgres + Temporal pointing at `DATABASE_URL` / Temporal env (native under `~/.forge/` or compose). For Cloud (Docker) sessions:

```bash
docker compose up -d
# FORGE_CLOUD_SANDBOX=docker
pnpm docker:sandbox
pnpm dev
```

Then open `http://127.0.0.1:5173`. Folder import uses an absolute path input.

## Supervisor

| Action                       | Behavior                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `ensureNativeStack`          | `~/.forge/pg` + `temporal server start-dev` under `~/.forge/temporal`; migrate                 |
| Cloud session preflight      | `docker info` when creating a Cloud session (`FORGE_CLOUD_SANDBOX=docker`)                     |
| `startInfra`                 | native stack, spawn server + orchestrator                                                      |
| `stopInfra`                  | kill process trees; optional `docker compose stop` (`desktop.stopComposeOnQuit`, default true) |
| `readConfig` / `writeConfig` | `~/.forge/config.json`                                                                         |

Renderer IPC is only `pickFolder` and `getStatus` (`window.forgeDesktop`). Node is not enabled in the UI.
