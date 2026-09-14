---
name: Workspace readiness
description: Evaluate session/workspace launch readiness and health; call get_workspace_health first, then stack skills.
---

# Workspace readiness

Use this skill when starting a workspace (or single-repo) session, or when launch/preview status is unclear.

## Evaluate

1. Call `get_workspace_health` (required). Do not invent toolchain or launch state.
2. Read `## Workspace repos` in the system prompt for member paths and detected stacks.
3. From the health tool output, note:
   - **External dependencies** — host/stack tools on PATH; **runtime version mismatches** (engines.node / .nvmrc vs session `node -v`, etc.); install-pending markers; **infra/DB** (Postgres/Mongo when detected); missing env/params. Sub-items list each gap; do not invent install commands here.
   - **Launch config** — whether `/workspace/.forge/launch.json` lists apps per member
   - **Internal services** — which declared apps are running
   - **Workspace analysis** — other saved findings (scripts, ports, dependsOn, …)

## Remediate (order)

1. If external deps fail/warn:
   - Missing host tools: tell the user what is missing; do not install via guesswork without `ask_user`.
   - **Runtime version mismatch:** invoke the stack skill (`nodejs-app`, `python-app`, …). For host Node: `ask_user` → `install_project_infra` (`dependencyId=node`, `version=<major>`) — not `setup_project_infra`, not `run_terminal`.
   - Install pending: identify stack per member → `invoke_skill` for that stack and follow the skill for package manager / install. Never hardcode a PM matrix in chat.
   - Infra/DB gaps: `ask_user` → `setup_project_infra` (`userApproved: true`); on missing host binaries → `install_project_infra` then retry setup.
   - Missing envs: `ask_user` → `upsert_workspace_parameter` (DB URLs may already be filled by infra setup).
2. Follow the stack skill for migrations / launch conventions.
3. `upsert_launch_app` with `cwd` under the member (workspace) or repo-relative cwd (single-repo).
4. `preview_start` backends before frontends when `dependsOn` says so.
5. Re-call `get_workspace_health` to confirm.

## Do not

- Dump health into the user reply unless asked — act on it.
- Put stack-specific install/PM matrices in prose — use stack skills.
- Run long-lived servers via `run_terminal` — use `preview_start`.
