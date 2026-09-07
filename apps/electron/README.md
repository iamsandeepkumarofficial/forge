# Forge desktop (Electron)

Chromium supervisor for local Forge. **Host mode (default):** native Postgres 16 + Temporal CLI under `~/.forge/`, no Docker required. **Docker mode:** set `SANDBOX_RUNTIME=docker` to keep compose postgres/temporal + sandbox image.

## Dev

If Electron fails to launch (`path.txt` missing, or `Library not loaded: Electron Framework`), the npm installer often leaves a stub `.app` (Node’s `extract-zip` on newer Node). `pnpm install` and `pnpm desktop` run `scripts/ensure-electron.mjs`, which checks for `Electron Framework` and falls back to system `unzip` of the cached zip. You can also run `pnpm --filter @forge/electron run postinstall`.

Host mode needs `postgres`/`initdb` (PG 16) and `temporal` on `PATH`, or binaries in `~/.forge/runtime/bin/`.

From the repo root:

```bash
pnpm desktop
```

This compiles the main/preload processes, opens an Electron window on `http://127.0.0.1:5173`, starts Vite if that port is down, and runs `startInfra` (native stack or compose + Node processes). Preview reverse-proxy stays **in-process** on the tool plane (`*.preview.localhost:8081`).

The preview pane is a `WebContentsView` (real Chromium document, not an iframe). The dock **DevTools** tab embeds the official DevTools frontend for that same view (`setDevToolsWebContents`). Browser-only `pnpm dev` keeps the iframe + facsimile inspector.

## Browser fallback

Host-mode browser contrib without Electron still needs a running Postgres + Temporal pointing at `DATABASE_URL` / Temporal env (native under `~/.forge/` or compose). For classic Docker sandboxes:

```bash
docker compose up -d
# SANDBOX_RUNTIME=docker
pnpm dev
```

Then open `http://127.0.0.1:5173`. Folder import uses an absolute path input.

## Supervisor

| Action                       | Behavior                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Host `ensureNativeStack`     | `~/.forge/pg` + `temporal server start-dev` under `~/.forge/temporal`; migrate; `SANDBOX_RUNTIME=host`               |
| Docker `preflightDocker`     | `docker info` (when `SANDBOX_RUNTIME=docker`)                                                                        |
| `startInfra`                 | native or compose up, spawn server + orchestrator                                                                    |
| `stopInfra`                  | kill process trees; optional `docker compose stop` (`desktop.stopComposeOnQuit`, default true; skipped in host mode) |
| `readConfig` / `writeConfig` | `~/.forge/config.json`                                                                                               |

Renderer IPC is only `pickFolder` and `getStatus` (`window.forgeDesktop`). Node is not enabled in the UI.
