# RFC 0010: Interactive Chat Revert

- **Status:** Accepted
- **Date:** 2026-09-11
- **Revision:** 2026-09-11 — file restore is a sidecar of files the agent touched, not git `commit-tree` / `reset --hard`. Batch file tools + `run_terminal` deny `rm`/`mv`. Branch copy-on-write clones the parent working tree (including install dirs) and restores after the forked turn.
- **Authors:** Forge contributors
- **Depends on:** [RFC 0005](./0005-local-session-git-worktrees.md) (session worktrees / member paths only)
- **Amends:** chat transcript delete-from-message; mutating file tools emit restore metadata; `run_terminal` cannot `rm`/`mv`; branch clones files to the fork point

## Summary

Undo on a user prompt reverts **two layers**:

1. **Transcript** — later `session_messages` are soft-deleted (`deleted_at`). UI and LLM history omit them.
2. **Workspace files** — restore every path the agent touched from this prompt’s turn **through later turns**, using saved **pre-mutation bytes**. Write `before` back, or delete the file if `before` is null (it was created in that range). **Do not** `git reset`, `commit-tree`, or move `HEAD`.

Chat revert does not require git. File restore does not require git.

## Motivation

`DELETE /api/sessions/:id/messages/from/:messageId` can hide the transcript, but later agent edits stay on disk. Users expect Undo to roll files back too.

A whole-tree git checkpoint (`write-tree` / hidden ref / `reset --hard`) pollutes the session repo, moves `HEAD` on restore, and snapshots files the agent never touched. Cursor stores **files the agent wrote/edited/deleted/moved**. Forge does the same.

That only works if mutating tools report **path + op + prior content**. `write_file` / `edit_file` must not return only a one-line `output`. `run_terminal` must not `rm`/`mv`.

## Goals

1. Soft-delete messages from the chosen user prompt onward; do not `DELETE` rows.
2. Snapshot **only files the agent touched**, on each mutating tool call (first touch of a path in a turn stores `before`).
3. On revert, restore those paths (this turn ∪ later turns), then hide messages, then send the edited prompt.
4. File tools are **batch**: one call may touch one file or many.
5. Add `delete_files` and `move_files`. Do **not** add `rewrite_files` — `write_file` already creates or overwrites.
6. `run_terminal` **refuses** `rm` and `mv` (including `git rm` / `git mv`).
7. Restore never runs git. `HEAD` / session branch / `git log` are unchanged.
8. Branch creates a **new** session whose files match the forked assistant turn (copy-on-write parent tree, restore later turns, remap checkpoints).

## Non-goals

- Restarting `preview_start` after restore or branch.
- Whole-tree snapshot at prompt time (walk, tarball, overlay, git `write-tree`).
- Snapshotting hand-edits or shell mutations that never went through file tools (`sed -i`, `>`, `python -c`, `find -delete`).
- Shared disk between parent and child chats (Cursor local fork).
- Undelete UI.
- `git clean -fdx` / wiping `node_modules`.
- Recursive directory delete/move in v1.

## Concepts

| Term              | Definition                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live messages** | `session_messages` with `deleted_at IS NULL`. UI list, LLM `loadChatMessages`, and branch `copyUntil` use only these.                                                             |
| **Touched file**  | A path a mutating file tool created, updated, deleted, or moved in a turn.                                                                                                        |
| **Checkpoint**    | Sidecar for one `turnId`: `metadata.json` + content-addressed `blobs/{sha256}` of each path’s **first** `before` in that turn. Thin pointer on `chat_turns.workspace_checkpoint`. |
| **Restore**       | For each path in this turn and **later** turns, apply the **earliest** `before` in that range (write bytes, or unlink if `before` is null). Same worktrees. No git.               |

## Transcript

`deleted_at` on `session_messages`. Revert sets it on **M** and every later live row. New edited prompt is a **new** row. `chat_turns` / chunks stay for audit and are not sent to the model.

`partsToModelMessages` is unchanged: it only sees the filtered list.

## File tools (batch)

One schema per tool. A single file is an array of length 1. Cap 20 entries.

```ts
write_file:   { files: [{ path, content }] }
edit_file:    { files: [{ path, oldString, newString, replaceAll? }] }
delete_files: { paths: string[] }
move_files:   { moves: [{ from, to }] }
```

- **`write_file`** — create or **overwrite** the whole file. This is rewrite. No `rewrite_files` tool.
- **`edit_file`** — search-replace in an existing file.
- **`delete_files`** / **`move_files`** — structured delete and rename. Files only in v1.

Keep tool ids `write_file` / `edit_file`. Ask/plan stay denied.

Per-path results: succeed what you can; `success` is false if any path failed. `metadata.files` lists only paths that actually changed.

```ts
metadata.files: Array<{
  path: string;
  op: "create" | "update" | "delete";
  before: string | null; // full prior bytes; null iff the file did not exist
}>
```

`move_files` emits two records per move: `delete` on `from` (with source `before`) and `create` or `update` on `to`.

Do not put this payload in the model-facing `output` string.

Host and docker both implement the same ops. Paths stay workspace-relative.

`upsert_launch_app` treats `.forge/launch.json` as one touched file.

## `run_terminal`

After the long-running-server check, **deny** commands whose **command word** is `rm` or `mv` (also `sudo rm`, `/bin/rm`, chained `ls && rm …`, and `git rm` / `git mv`).

Do **not** match `\brm\b` anywhere: `npm rm`, `docker rm`, `podman rm` stay allowed.

Denied message: use `delete_files` or `move_files`.

## Workspace checkpoint

Not taken as a full tree at turn start. On each **successful** mutating file-tool result for this `turnId`:

1. For each `metadata.files[]` path **not yet** in this turn’s snapshot, persist `before` (content-addressed blob; null marker for create).
2. Later touches of the same path in the same turn do not overwrite that original `before`.
3. `chat_turns.workspace_checkpoint` stores a pointer + file list, not full file bodies:

```json
{
  "version": 1,
  "files": [{ "path": "web/src/app.ts", "op": "update", "blob": "<sha256>" }]
}
```

On-disk: `~/.forge/sessions/_checkpoints/{sessionId}/{turnId}/metadata.json` and `blobs/{sha256}`.

Ignore legacy `{ repoName: sha }` maps on restore (do not `git reset`).

## Restore

Revert of user message **M** (`M.turnId` = T):

1. Collect checkpoints for T and every later turn on this session.
2. Union of paths. For each path, take the **earliest** `before` in that range.
3. `before !== null` → write those bytes (create parents if needed). `before === null` → unlink if present.
4. If restore fails, **do not** hide messages (request fails).
5. Soft-delete M and later live rows.
6. Client sends the edited prompt; the new turn records its own touches.

```text
Turn 2: write a.ts (before A0)
Turn 3: write a.ts (before A1), create b.ts (before null)

Revert M2: a.ts ← A0, delete b.ts
HEAD unchanged
```

If no file tools ran from T onward, restore is a no-op; transcript still hides.

## Restore policy

| Situation                      | Files     | Messages                       |
| ------------------------------ | --------- | ------------------------------ |
| Checkpoint blobs apply cleanly | Restored  | Soft-deleted                   |
| Restore fails (IO / allowlist) | Unchanged | **Not** hidden (request fails) |
| No touched files in range      | Unchanged | Soft-deleted                   |

Do not hide Undo. Missing git is irrelevant.

## API

`DELETE /api/sessions/:sessionId/messages/from/:messageId` (unchanged URL):

1. 404 if M is missing or already hidden.
2. Restore touched files from `M.turnId` through later turns.
3. Soft-delete M and later live rows.
4. `{ deleted, workspaceRestored }`.

Persist the sidecar when file tools return `metadata.files`. There is no turn-start git checkpoint API.

`POST /api/sessions/:sessionId/branch` `{ untilMessageId, targetSessionId }`:

1. 404 if the fork message is missing; 409 if the target already has messages.
2. Provision the target sandbox, copy-on-write the parent working tree (skip only `.git` / `.forge-runtime`; include install and build dirs), then restore paths touched **after** the forked assistant’s turn.
3. Copy live messages through that id. Remap `turnId`s and copy checkpoint blob dirs for the prefix only.
4. `{ copied, workspaceCloned }`. Fail the request if the file clone throws (do not copy transcript-only).

## Branch

Branch is a **new** chat (same workspace or project). The parent transcript and worktree stay unchanged. Cursor Fork Chat shares one disk; Forge does not.

Fork is the finished **assistant** message (end of turn T):

1. New session + provision from canonical (keeps the child’s own git worktree pointer).
2. Copy-on-write the parent working tree onto the child (not `.git` / `.forge-runtime`). Install trees and build dirs come along so the child is runnable without a stack-specific reinstall. Host uses clonefile/reflink when the filesystem supports it; Docker overlay is a tar copy.
3. Apply `restorePlanAfterTurn(T)`: earliest `before` for paths touched in **later** parent turns only, written onto the **child**.
4. Duplicate prefix `chat_turns` (new ids, `copied:{session}:{turn}` workflow ids) and sidecar dirs. Copied messages keep remapped `turnId` so Undo on the child restores the child’s tree.

```text
Parent:  M1 → A1 → M2 → A2 → M3 → A3
Branch from A2:

  Child messages: M1, A1, M2, A2
  Child files:    parent tree with T3+ undone
  Parent:         unchanged
```

## Out of scope (accepted)

- Preview process restart after restore or branch.
- Terminal before/after inventory for non-`rm`/`mv` shell mutations.
- Shared disk between parent and child chats.
