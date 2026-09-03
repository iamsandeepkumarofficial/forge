---
name: Backend app
description: Run API servers (Express, Fastify, Nest, Django, FastAPI) on published ports with DB env from Forge.
---

# Backend app

Use for APIs and workers that frontends call. See also: `nodejs-app`, `python-app`, `db-migrations`.

## Identify

- Node: `express`, `fastify`, `@nestjs/core` in `package.json`.
- Python: `manage.py`, `pyproject.toml`, `requirements.txt` with django/fastapi/flask.
- `type: "api"` in launch.json (workspace sessions auto-start APIs).

## Startup

1. Ensure DB env: `DATABASE_URL`, `MONGODB_URI` are in the sandbox (Forge-provided). **Do not** apt-install Postgres/Mongo.
2. Run migrations first (`db-migrations` skill).
3. `upsert_launch_app` with `type: "api"`, `port: 3001` (or next free), command from `package.json` or framework defaults.
4. `preview_start`.

## CORS

- Allow the frontend preview origin (workspace gateway URL or port 3000 app).
- Bind `0.0.0.0` and honor `PORT`.

## Workspace wiring

- Register API before frontend when `dependsOn` says so.
- Use `{{svc.internalUrl}}` in member env for service discovery.

## Health

- Prefer `/health` or `/api/health` for `preview_start` TCP check (process must listen on assigned port).
