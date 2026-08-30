---
name: Node.js app
description: Package manager detection, install, scripts, and mapping package.json to Forge launch.json for Node repos.
---

# Node.js app

Use for any repo with `package.json`. See also: `frontend-app`, `backend-app`, framework skills.

## Package manager

1. Read `packageManager` in `package.json` if present (`pnpm@9`, etc.).
2. Else lockfile at repo root: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, else npm.
3. Install (via `run_terminal`, `background: true` for large trees):
   - pnpm: `pnpm install --frozen-lockfile` when lockfile exists
   - yarn: `yarn install --frozen-lockfile`
   - npm: `npm ci` when `package-lock.json` exists, else `npm install`

## Dev / start commands

- Prefer `scripts.dev`; fallback `scripts.start`.
- Map to `.forge/launch.json` with `command` using the detected PM (`pnpm run dev`, `yarn dev`, `npm run dev`).
- **Never** run dev servers via `run_terminal` — use `upsert_launch_app` then `preview_start`.

## Ports and preview

- Set `port` in **3000–3009** (first web app → 3000).
- Apps must honor `PORT` and bind `HOST=0.0.0.0` (Forge sets both).

## Framework hints

- **next** in deps → see `nextjs-app`
- **react** without next → `reactjs-app`
- **vue** / **nuxt** → `vuejs-app`
- **express** / **fastify** / **@nestjs/core** → `backend-app`

## Workspace sessions

- Set `cwd` under the member repo (`bp-frontend` or `bp-frontend/apps/web`).
- Forge writes **session-root** `/workspace/.forge/launch.json` (one file for all members). Do **not** create per-member `.forge/launch.json`.

## Node version

- Check `engines.node` and `.nvmrc`. If mismatch, note it for the user; do not install nvm in sandbox unless asked.
