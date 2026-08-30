---
name: Python app
description: Python/Django/FastAPI/Flask detection, toolchain prep, venv install, and run commands with HOST/PORT for Forge preview.
---

# Python app

Use for any member with Python ecosystem evidence (`requirements.txt`, `pyproject.toml`, `manage.py`, etc.).

## Runtime / toolchain (required)

1. Run `python3 --version` (and `pip3 --version` if present) in the member directory via `run_terminal`.
2. **If Python is missing** (common on `forge-sandbox-generic`):
   - Tell the user the sandbox needs a Python toolchain.
   - **Propose** an install (e.g. `apt-get update && apt-get install -y python3 python3-pip python3-venv`).
   - Wait for explicit user approval.
   - Only then run the install via `run_terminal`.
3. Do **not** silently apt-install without approval.
4. If the session is on the Node image (`forge-sandbox`) and Python is missing, same propose → approve → install flow (or propose recreating onto generic / Node as appropriate).

## Detect layout

- **Django**: `manage.py` → `python manage.py runserver 0.0.0.0:$PORT`
- **FastAPI**: `uvicorn main:app --host 0.0.0.0 --port $PORT` (adjust module path)
- **Flask**: `flask run --host=0.0.0.0 --port=$PORT`
- **Deps** (after python3 is available):
  - `requirements.txt` → create venv if needed, then `pip install -r requirements.txt`
  - `pyproject.toml` + Poetry → `poetry install` (install poetry only after user OK if missing)
  - `uv.lock` / uv project → `uv sync` (install uv only after user OK if missing)

Use `run_terminal` with `background: true` for large installs; poll logs until success.

## Forge launch.json

```json
{ "name": "api", "cwd": ".", "command": "python manage.py runserver 0.0.0.0:$PORT", "port": 3001, "type": "api" }
```

In workspaces set `cwd` under the member (e.g. `bp-backend`). Use `upsert_launch_app` then `preview_start`. See `backend-app`, `db-migrations`.

## Env / DB

- Prefer injected `DATABASE_URL` / `MONGODB_URI` after user-approved `provision_app_engine`.
- Map Django `DATABASES` via env if the project supports it.
- Run migrations via `run_terminal` before `preview_start` for APIs.
