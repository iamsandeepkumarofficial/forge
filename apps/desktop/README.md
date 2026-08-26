# Forge desktop (Tauri)

Local supervisor for Forge (RFC 0002 / RFC 0004).

## Dev

From the repo root (after `docker` is available):

```bash
pnpm desktop
```

This loads `@forge/web-ui` at `http://127.0.0.1:5173` in the webview and runs `start_infra` on launch (compose postgres + temporal, sandbox image if needed, server + orchestrator). Preview reverse-proxy runs **in-process** on the tool plane (`*.preview.localhost:8081`).

Apps must listen on container ports **3000–3009**.

## Browser fallback

```bash
docker compose up -d
pnpm dev
```

Then open `http://127.0.0.1:5173`. Folder import uses an absolute path input instead of the native picker.

## Supervisor commands

| Command | Behavior |
| ------- | -------- |
| `preflight_docker` | `docker info` |
| `start_infra` | compose up, sandbox build, spawn Node processes |
| `stop_infra` | kill children; optional `docker compose stop` |
| `read_config` / `write_config` | `~/.forge/config.json` |
