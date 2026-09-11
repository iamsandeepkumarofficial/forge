# Forge issue notes

Postmortems and fix write-ups for bugs that are easy to reintroduce. Prefer linking RFCs when the fix encodes architecture.

| ID                                                    | Title                                                                                   | Status | Date       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ | ---------- |
| [0001](./0001-host-preview-hostname-port-mismatch.md) | Host preview hostname vs listen port mismatch (UI shows 40xxx, traffic looks like 3000) | Fixed  | 2026-09-10 |
| [0002](./0002-stale-preview-across-sessions.md)       | Stale Electron preview from another session on workbench load                           | Fixed  | 2026-09-10 |
| [0003](./0003-preview-start-empty-terminal.md)        | `preview_start` terminal empty / wrong log stream / CRLF staircase                      | Fixed  | 2026-09-11 |
| [0004](./0004-stale-job-terminals-preview-hmr.md)     | Stale completed job terminals; preview blank until refresh; Vite HMR WS                 | Fixed  | 2026-09-11 |
| [0005](./0005-chat-live-thinking-tools-actions.md)    | Live thinking vanishes; duplicate tools; Copy/Branch/⋯ per LLM step                     | Fixed  | 2026-09-11 |
| [0006](./0006-single-repo-workspace-member-path.md)   | Single-repo sessions flattened under `/workspace` instead of `/workspace/<repo>`        | Fixed  | 2026-09-11 |
| [0007](./0007-chat-turns-rounds-column-missing.md)    | `POST /chat` fails: `column "rounds" does not exist`                                    | Fixed  | 2026-09-11 |
| [0008](./0008-ghost-preview-terminals-stop.md)        | Ghost `preview_start` terminals after branch; Stop blanks preview but leaves processes  | Fixed  | 2026-09-11 |
