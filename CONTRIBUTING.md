# Contributing to Forge

Thanks for helping build Forge—an open-source, locally runnable coding agent harness. By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to run locally

### Prerequisites

- Docker (daemon running)
- Node.js 20+
- pnpm (version pinned in root `packageManager`)

### Steps

```bash
docker compose up -d
pnpm install
cp .env.example .env
# Add LLM provider keys to .env
pnpm docker:sandbox
pnpm --filter @forge/db db:migrate
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The desktop supervisor is Electron (`pnpm desktop`). Prefer compose + `pnpm dev` for day-to-day contribution. See [RFC 0002](./docs/rfcs/0002-local-desktop-runtime.md).

## Code layout

Monorepo managed with **pnpm** and **Turborepo**.

| Path | Role |
| ---- | ---- |
| `apps/server` | Tool-plane HTTP API, sandbox lifecycle, tools, in-process preview proxy |
| `apps/web-ui` | Chat workbench (React) |
| `apps/preview-plane` | Optional standalone preview proxy (`PREVIEW_IN_PROCESS=0` / k8s) |
| `apps/electron` | Electron desktop supervisor (`pnpm desktop`) |
| `packages/orchestrator` | Temporal worker and chat turn workflows |
| `packages/core` | Shared backend domain logic |
| `packages/db` | Schema and migrations |
| `packages/tools` | Sandbox tool implementations |
| `packages/agents` | Agent mode definitions |
| `packages/skills` | Packaged skills |
| `packages/workflows` | Workflow definitions (trimmed toward chat-only) |
| `packages/fe-core`, `packages/ui` | Shared client/UI packages when used by the shell |

Apps are thin adapters. Prefer putting durable domain logic in `packages/*` rather than growing app-only business rules.

## Pull request expectations

Before opening a PR:

1. Run **`pnpm typecheck`**, **`pnpm lint`**, and **`pnpm test`** locally (and `pnpm build` for packaging-sensitive changes).
2. Keep diffs focused; match existing style and TypeScript strictness.
3. Add or update sibling unit tests (`*.test.ts` / `*.test.tsx`) for behavior you change.
4. Link relevant design docs when the change is architectural.

### Design documents

Material design lives in [`docs/rfcs/`](./docs/rfcs/README.md). Read those before large refactors to workspaces, desktop runtime, or extraction boundaries. Propose a new or updated RFC when you change an accepted decision.

## License

Contributions are licensed under the [Apache License 2.0](./LICENSE).
