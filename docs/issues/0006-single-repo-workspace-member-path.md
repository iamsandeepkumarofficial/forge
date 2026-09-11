# 0006: Single-repo sessions flattened under `/workspace` instead of `/workspace/<repo>`

- **Status:** Fixed
- **Date:** 2026-09-11
- **Severity:** Files tree / tools disagree with multi-repo workspaces; folders look empty or lag
- **Related RFC:** [0005](../rfcs/0005-local-session-git-worktrees.md)

## Summary

Multi-repo workspaces already materialize each member at `/workspace/<repoName>`. Single-project sessions copied the tree to `/workspace` itself. File tools, launch CWD, inventory, and the Files pane then mixed “workspace root” with “repo root,” so folders often failed to open and file contents looked wrong.

## Fix

Always materialize a member under `/workspace/<repoDirForProject>` (same helper as multi-repo). Host FS allowlist / resolve require the first path segment to be a member name when `hostWorktrees` is set. Launch CWD and repo inventory walk member dirs rather than treating `/workspace` as the git root.

Member folders stay the workspace roots for file tools. RFC 0010 file restore uses touched-file blobs, not git init on `/workspace`.

## Key files

| Area        | Path                                                     |
| ----------- | -------------------------------------------------------- |
| Materialize | `apps/server/src/projects/sessionSandbox/materialize.ts` |
| Host FS     | `apps/server/src/projects/hostWorkspaceFs.ts`            |
| Launch CWD  | `apps/server/src/projects/launchCwd.ts`                  |
| Inventory   | `apps/server/src/projects/repoInventory.ts`              |

## Regression risks

- Special-casing `members.length === 1` to copy into `/workspace` again.
- Resolving host paths without the member prefix while `hostWorktrees` is populated.
