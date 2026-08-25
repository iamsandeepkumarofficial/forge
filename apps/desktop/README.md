# Forge Desktop (`@forge/desktop`)

WIP Tauri 2 shell that will own local infrastructure lifecycle per
[RFC 0002](../../docs/rfcs/0002-local-desktop-runtime.md).

## Prerequisites

- **Rust** toolchain (`rustup`, stable)
- **Tauri CLI** (`pnpm --filter @forge/desktop exec tauri --version` or
  `cargo install tauri-cli`)
- **Docker** (Desktop or compatible engine) — required for compose + sandbox
- Node / **pnpm** for the monorepo UI and harness packages

Icons and a full `tauri build` are not wired yet; this package is a scaffold.

## Scripts

```bash
pnpm --filter @forge/desktop tauri dev
pnpm --filter @forge/desktop tauri build
```

## Supervisor commands (stubs)

Rust commands in `src-tauri/src/main.rs` (TODOs):

| Command | Intent |
| ------- | ------ |
| `preflight_docker` | Detect Docker daemon |
| `start_infra` | `docker compose up -d`, sandbox image, spawn Node processes + inject `FORGE_POC_TOKEN` |
| `stop_infra` | Stop harness processes / optional compose stop |
| `read_config` / `write_config` | `~/.forge/config.json` |

Until these land, run infra with root `docker compose` + `pnpm dev` and use the
browser UI.
