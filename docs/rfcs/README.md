# Forge RFCs

Design decisions for Forge are recorded as RFCs in this directory. Accepted RFCs describe the intended architecture for contributors implementing or reviewing changes.

## Index

| RFC | Title | Status | Summary |
| --- | ----- | ------ | ------- |
| [0001](./0001-harness-extraction.md) | Harness Extraction | Accepted | Carve a chat-only, locally runnable coding-agent harness (Apache-2.0) from the upstream product: tool-plane, Temporal orchestrator, preview-plane, Docker sandbox, and Tauri desktop. |
| [0002](./0002-local-desktop-runtime.md) | Local Desktop Runtime | Accepted | Tauri supervisor boot/shutdown sequence, `~/.forge/config.json` for LLM keys, loopback auth, and `*.preview.localhost` previews. |
| [0003](./0003-workspace-and-repo-connection.md) | Workspace and Repo Connection | Accepted | Flatten projects to workspaces; connect a local folder or git clone; materialize session sandboxes; no GitHub OAuth in v1. |

## Process

1. For material design changes, add a new numbered RFC (or amend an existing one) under `docs/rfcs/`.
2. Prefer small, focused RFCs over rewriting history in place when a decision reverses course—mark older RFCs **Superseded** and link forward.
3. Implementation PRs should link the relevant RFC when they enact an accepted design.

Status values in use: **Draft**, **Accepted**, **Superseded**, **Withdrawn**.
