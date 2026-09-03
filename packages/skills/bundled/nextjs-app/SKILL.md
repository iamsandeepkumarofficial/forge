---
name: Next.js app
description: Next.js dev server on Forge ports with NEXT_PUBLIC env and monorepo cwd paths.
---

# Next.js app

See also: `nodejs-app`, `frontend-app`.

## Dev command

- `next dev -p $PORT -H 0.0.0.0` or `pnpm run dev` if script passes host/port.
- launch.json: `port: 3000`, `type: "web"`.

## Env

- `NEXT_PUBLIC_*` for browser-visible config (API URLs, etc.).
- Server-only secrets without `NEXT_PUBLIC_` prefix.

## App Router vs Pages

- Entry: `app/` or `pages/`. Read `next.config.js` for `basePath` if workspace gateway strips prefixes.

## API routes

- Next API routes run in the same process — one launch app is usually enough unless a separate API repo exists.

## Workspace

- `cwd` = member root or `apps/web` where `package.json` with `next` dep lives.
