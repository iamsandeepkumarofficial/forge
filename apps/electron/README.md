# Forge desktop (Electron)

Chromium supervisor for local Forge: Docker preflight, compose postgres + temporal, sandbox image, spawn server + orchestrator, load `@forge/web-ui`.

## Dev

If Electron fails to launch (`path.txt` missing, or `Library not loaded: Electron Framework`), the npm installer often leaves a stub `.app` (Node’s `extract-zip` on newer Node). `pnpm install` and `pnpm desktop` run `scripts/ensure-electron.mjs`, which checks for `Electron Framework` and falls back to system `unzip` of the cached zip. You can also run `pnpm --filter @forge/electron run postinstall`.

From the repo root (Docker available):

```bash
pnpm desktop
```

This compiles the main/preload processes, opens an Electron window on `http://127.0.0.1:5173`, starts Vite if that port is down, and runs `startInfra` (compose + Node processes). Preview reverse-proxy stays **in-process** on the tool plane (`*.preview.localhost:8081`).

The preview pane is a `WebContentsView` (real Chromium document, not an iframe). The dock **DevTools** tab embeds the official DevTools frontend for that same view (`setDevToolsWebContents`). Browser-only `pnpm dev` keeps the iframe + facsimile inspector.

## Browser fallback

```bash
docker compose up -d
pnpm dev
```

Then open `http://127.0.0.1:5173`. Folder import uses an absolute path input.

## Supervisor

| Action | Behavior |
| ------ | -------- |
| `preflightDocker` | `docker info` |
| `startInfra` | compose up, sandbox build, spawn server + orchestrator |
| `stopInfra` | kill process trees; optional `docker compose stop` (`desktop.stopComposeOnQuit`, default true) |
| `readConfig` / `writeConfig` | `~/.forge/config.json` |

Renderer IPC is only `pickFolder` and `getStatus` (`window.forgeDesktop`). Node is not enabled in the UI.
