---
name: Vue app
description: Vue 3 / Nuxt dev servers with Vite or vue-cli on Forge preview ports.
---

# Vue app

See also: `nodejs-app`, `frontend-app`.

## Vite + Vue

- Same as React Vite: `--host 0.0.0.0`, honor `PORT`.
- Env: `VITE_*`.

## Vue CLI

- `vue-cli-service serve --port $PORT --host 0.0.0.0`.

## Nuxt

- `nuxt dev --hostname 0.0.0.0 --port $PORT` or script from `package.json`.

## launch.json

```json
{ "name": "web", "cwd": ".", "command": "pnpm run dev", "port": 3000, "type": "web" }
```

## API proxy

- Configure `vite.config.ts` `server.proxy` toward backend member URL.
