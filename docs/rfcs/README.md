# Forge RFCs

Design decisions for Forge are recorded as RFCs in this directory. Accepted RFCs describe the intended architecture for contributors implementing or reviewing changes.

## Index

| RFC                                              | Title                                      | Status   | Summary                                                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](./0001-harness-extraction.md)             | Harness Extraction                         | Accepted | Carve a chat-only, locally runnable coding-agent harness (Apache-2.0) from the upstream product: tool-plane, Temporal orchestrator, preview-plane, Docker sandbox, and Electron desktop. |
| [0002](./0002-local-desktop-runtime.md)          | Local Desktop Runtime                      | Accepted | Desktop supervisor boot/shutdown sequence, `~/.forge/config.json` for LLM keys, loopback auth, and `*.preview.localhost` previews.                                                       |
| [0003](./0003-workspace-and-repo-connection.md)  | Workspace and Repo Connection              | Accepted | Flatten projects to workspaces; connect a local folder or git clone; materialize session sandboxes; no GitHub OAuth in v1.                                                               |
| [0004](./0004-single-user-desktop-forge.md)      | Single-User Desktop Forge                  | Accepted | Drop POC token/email auth; copy selected folders to `~/.forge/projects/`; auto-preview on session start; Electron supervisor; desktop-first with browser fallback. Amends 0002/0003.     |
| [0005](./0005-local-session-git-worktrees.md)    | Local Session Git Worktrees                | Draft    | Per-session git worktrees for local projects; keep `.git` in canonical; rewrite gitdir + mount at `/forge-git/{id}` so in-container git works. Amends 0003/0004.                         |
| [0006](./0006-local-host-runtime-zero-docker.md) | Local Host Runtime and Zero-Docker Desktop | Draft    | Host-mode `SandboxRuntime` with OS sandbox, native Postgres/Temporal, port registry, and agent tools without Docker; Docker/K8s remain cloud mode. Amends 0001/0002.                     |

## Process

1. For material design changes, add a new numbered RFC (or amend an existing one) under `docs/rfcs/`.
2. Prefer small, focused RFCs over rewriting history in place when a decision reverses course—mark older RFCs **Superseded** and link forward.
3. Implementation PRs should link the relevant RFC when they enact an accepted design.

Status values in use: **Draft**, **Accepted**, **Superseded**, **Withdrawn**.
