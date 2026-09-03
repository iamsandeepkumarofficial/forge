# Forge

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

**Forge** is an open-source **coding agent harness**: a chat UI, tool-plane API, Temporal orchestrator, Docker sandbox, and local preview proxy that you can run on your own machine.

Connect a local folder or clone a git repository, chat with an LLM-backed agent, and let tools run inside an isolated Docker sandbox—with session previews on `*.preview.localhost`.

Licensed under the [Apache License 2.0](./LICENSE). Copyright 2026 Forge contributors.

## Prerequisites

- **Docker** (Docker Desktop or a compatible engine) for Postgres, Temporal, MinIO, and sandboxes
- **Node.js 20+**
- **pnpm** (see `packageManager` in `package.json`)

An LLM API key (OpenAI, Anthropic, or an OpenAI-compatible endpoint) is required to run chats.

## Quick start (contributors)

```bash
# 1. Start local infra
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Configure env
cp .env.example .env
# Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY (or OpenAI-compatible settings)

# 4. Build the sandbox image (needed for agent tool sessions)
pnpm docker:sandbox

# 5. Apply database migrations
pnpm --filter @forge/db db:migrate

# 6. Run server, orchestrator, and web UI
pnpm dev
```

Typical local ports:

| Service | Port |
| ------- | ---- |
| Tool-plane API (`apps/server`) | `4000` |
| Web UI | `5173` |
| Postgres (Docker) | `5433` |
| Temporal gRPC / UI | `7233` / `8233` |
| MinIO | `9000` (console `9001`) |

Open the web UI, connect a workspace (local folder or git clone once that flow lands), and start a chat.

Quality gates before you push:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Desktop app

Forge is designed to ship as a **Tauri** desktop app that:

- Detects Docker and runs `docker compose up`
- Builds the sandbox image when needed
- Spawns the server and orchestrator (preview reverse-proxy runs in-process on the server)
- Opens the chat UI in a webview (single-user local mode — no POC token)
- Reads LLM settings from `~/.forge/config.json`

The desktop shell (`apps/desktop`) is **work in progress / scaffold**—contributors should use the docker-compose + `pnpm dev` path above until the supervisor lands. Design details: [RFC 0002: Local Desktop Runtime](./docs/rfcs/0002-local-desktop-runtime.md).

## Architecture (short)

- **tool-plane** (`apps/server`) — HTTP API, sandbox lifecycle, tools, and in-process preview proxy (`*.preview.localhost:8081`)
- **orchestrator** (`packages/orchestrator`) — Temporal worker for interactive chat turns
- **preview-plane** (`apps/preview-plane`) — optional standalone preview proxy (k8s / `PREVIEW_IN_PROCESS=0`)
- **web-ui** (`apps/web-ui`) — chat workbench
- **Docker sandbox** — per-session isolated workspace

See the RFCs for the full picture.

## Documentation

Design RFCs live under [`docs/rfcs/`](./docs/rfcs/README.md):

- [0001 — Harness Extraction](./docs/rfcs/0001-harness-extraction.md)
- [0002 — Local Desktop Runtime](./docs/rfcs/0002-local-desktop-runtime.md)
- [0003 — Workspace and Repo Connection](./docs/rfcs/0003-workspace-and-repo-connection.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
