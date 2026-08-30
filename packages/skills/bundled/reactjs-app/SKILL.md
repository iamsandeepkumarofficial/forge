---
name: React app
description: Vite and CRA React dev servers with correct HOST/PORT for Forge preview.
---

# React app

See also: `nodejs-app`, `frontend-app`.

## Vite

- Dev: `pnpm run dev` with vite config `--host 0.0.0.0 --port $PORT` or set `server.host` / `server.port` in `vite.config.ts`.
- Env: `VITE_*` prefix for client vars.

## Create React App

- `react-scripts start` — set `HOST=0.0.0.0` and `PORT` (Forge injects PORT).
- Env: `REACT_APP_*`.

## launch.json example

```json
{ "name": "web", "cwd": ".", "command": "pnpm run dev", "port": 3000, "type": "web" }
```

Monorepo: `cwd: "apps/web"` under member repo.

## Proxy to API

- Vite `server.proxy` or CRA `proxy` in package.json — point at workspace API internal URL or `http://localhost:3001`.
