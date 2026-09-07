# Forge

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

**Forge** is an open-source **coding agent harness**: a chat UI, tool-plane API, Temporal orchestrator, session sandbox (host or Docker), and local preview proxy that you can run on your own machine.

Connect a local folder or clone a git repository, chat with an LLM-backed agent, and let tools run in an isolated session—with previews on `*.preview.localhost`.

Licensed under the [Apache License 2.0](./LICENSE). Copyright 2026 Forge contributors.

## Prerequisites

- **Node.js 20+**
- **pnpm** (see `packageManager` in `package.json`)
- **Host mode (desktop default):** Postgres 16 client tools (`initdb`/`postgres`) and Temporal CLI on `PATH`, or binaries under `~/.forge/runtime/bin/` — **no Docker daemon**
- **Docker mode (optional):** Docker Desktop or a compatible engine for compose Postgres/Temporal/MinIO and container sandboxes (`SANDBOX_RUNTIME=docker`)

An LLM API key (OpenAI, Anthropic, or an OpenAI-compatible endpoint) is required to run chats.

## Quick start (contributors)

### Host mode (no Docker)

Desktop defaults to host mode (`FORGE_DESKTOP=1` → `SANDBOX_RUNTIME=host`):

```bash
pnpm install
cp .env.example .env
# Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY
pnpm desktop
```

Infra lives under `~/.forge/` (Postgres data, Temporal). Open Activity from the home header to inspect live sessions, ports, and preview apps.

### Docker mode

```bash
# 1. Start local infra
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Configure env
cp .env.example .env
# Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY (or OpenAI-compatible settings)
# Optional: SANDBOX_RUNTIME=docker (required when not using Electron desktop)

# 4. Build the sandbox image (needed for agent tool sessions)
pnpm docker:sandbox

# 5. Apply database migrations
pnpm --filter @forge/db db:migrate

# 6. Run server, orchestrator, and web UI
pnpm dev
```

Typical local ports:

| Service                                 | Port                    |
| --------------------------------------- | ----------------------- |
| Tool-plane API (`apps/server`)          | `4000`                  |
| Web UI                                  | `5173`                  |
| Postgres (host `~/.forge/pg` or Docker) | `5433`                  |
| Temporal gRPC / UI                      | `7233` / `8233`         |
| MinIO (Docker mode)                     | `9000` (console `9001`) |

Open the web UI, connect a workspace (local folder or git clone once that flow lands), and start a chat.

**Smoke (host mode):** launch desktop → connect a folder → send a chat turn → open Activity → confirm session/ports → stop session. No `docker info` required.

Quality gates before you push:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Desktop app

Forge ships as an **Electron** desktop app (`apps/electron`) that:

- Defaults to **host mode**: native Postgres 16 + Temporal under `~/.forge/` (no Docker)
- Optional **Docker mode** via `SANDBOX_RUNTIME=docker` (compose + sandbox image)
- Spawns the server and orchestrator (preview reverse-proxy runs in-process on the server)
- Opens the chat UI in Chromium (single-user local mode — no POC token)
- Reads LLM settings from `~/.forge/config.json`

```bash
pnpm desktop
```

Contributors can use host-mode desktop, or docker-compose + `pnpm dev` and open `http://127.0.0.1:5173`. Design details: [RFC 0002](./docs/rfcs/0002-local-desktop-runtime.md), [RFC 0006](./docs/rfcs/0006-local-host-runtime-zero-docker.md).

## Architecture (short)

- **tool-plane** (`apps/server`) — HTTP API, sandbox lifecycle, tools, and in-process preview proxy (`*.preview.localhost:8081`)
- **orchestrator** (`packages/orchestrator`) — Temporal worker for interactive chat turns
- **preview-plane** (`apps/preview-plane`) — optional standalone preview proxy (k8s / `PREVIEW_IN_PROCESS=0`)
- **web-ui** (`apps/web-ui`) — chat workbench
- **desktop** (`apps/electron`) — Electron supervisor (`pnpm desktop`)
- **SandboxRuntime** — host process (Seatbelt/bwrap) or Docker/K8s per session

See the RFCs for the full picture.

## Documentation

Design RFCs live under [`docs/rfcs/`](./docs/rfcs/README.md):

- [0001 — Harness Extraction](./docs/rfcs/0001-harness-extraction.md)
- [0002 — Local Desktop Runtime](./docs/rfcs/0002-local-desktop-runtime.md)
- [0003 — Workspace and Repo Connection](./docs/rfcs/0003-workspace-and-repo-connection.md)
- [0006 — Local Host Runtime (zero-Docker)](./docs/rfcs/0006-local-host-runtime-zero-docker.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
