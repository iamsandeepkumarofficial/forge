# Upcoming features

Product features that are planned but not scheduled for immediate implementation.
For QA / bug follow-ups, see [qa-backlog.md](./qa-backlog.md).

## Desktop dependency install screen

**Status:** planned / not started (partial agent path exists via `install_project_infra`)

**Problem:** Host-mode desktop requires PostgreSQL 16 (`initdb` / `postgres`) and the Temporal CLI on `PATH`, Homebrew paths, or `~/.forge/runtime/bin/`. `pnpm install` does not install these; `ensureNativeStack` only discovers and starts them.

**Proposal:** First-run / boot UI that detects missing binaries and installs or guides install into `~/.forge/runtime/bin/` (or via system package managers) so catalog Postgres + Temporal work without manual setup. Agent-driven DB installs already use `install_project_infra` (tarball → `~/.forge/runtime`).

**Related:** `apps/electron/src/nativeStack.ts` (`resolveNativeBin`, `ensureNativeStack`), `apps/server/src/projects/hostInfra/*`.

## Local session external services (DB, cache, workers)

**Status:** planned / not started

**Problem:** Workspaces need optional infra (Mongo, Redis, workflow engines, etc.). Today Postgres/Mongo go through `setup_project_infra`; host binaries via `install_project_infra`. Local sessions must not start Docker for these; Cloud sessions may. Detection is ad hoc (TCP listen + binary on PATH / `~/.forge/runtime/bin`).

**Proposal:** A shared “external service” model: detect need from repo shadows → `ask_user` → for **local** sessions `install_project_infra` (extensible tarball registry into `~/.forge/runtime`) then `setup_project_infra`, for **cloud** sessions use Docker/k8s. Extend the install registry beyond mongo/postgres.

**Related:** `apps/server/src/projects/appDb/*`, `apps/server/src/projects/hostInfra/*`, `setup_project_infra`, `install_project_infra`, session `executionTarget`.
