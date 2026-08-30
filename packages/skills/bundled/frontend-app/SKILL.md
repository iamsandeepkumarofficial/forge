---
name: Frontend app
description: Identify and run web frontends (Vite, CRA, Next, Vue) in Forge preview on ports 3000–3009.
---

# Frontend app

Use when the member is a browser UI. See also: `nodejs-app`, `reactjs-app`, `nextjs-app`, `vuejs-app`.

## Identify

- `package.json` deps: `vite`, `react`, `next`, `vue`, `nuxt`, `@remix-run/react`.
- `type: "web"` in launch.json.
- Often has `index.html` or `src/main.tsx` / `app/` (Next).

## Startup flow

1. `invoke_skill` → `nodejs-app` if install/PM unclear.
2. Ensure `.forge/launch.json` has a **web** app with `port: 3000` (or next free 3001…).
3. `preview_start` — not `run_terminal` for dev servers.

## Backend URL

- In workspaces, read member `env` templates (`{{backend.internalUrl}}`) or workspace parameters.
- For Vite: `VITE_*` env vars; Next: `NEXT_PUBLIC_*`; CRA: `REACT_APP_*`.

## Common issues

- Blank preview → wrong port (must be 3000–3009) or server bound to localhost only.
- API errors → start backend first when `dependsOn` lists it; check CORS on API.

## Build vs dev

- Use `preview_start` for dev preview. Use `run_terminal` for one-off `pnpm build` / typecheck.
