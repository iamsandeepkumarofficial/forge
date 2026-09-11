# RFC 0010: Interactive Chat Revert

- **Status:** Accepted
- **Date:** 2026-09-11
- **Authors:** Forge contributors
- **Depends on:** [RFC 0005](./0005-local-session-git-worktrees.md)
- **Amends:** chat transcript delete-from-message; session worktrees gain hidden checkpoint refs

## Summary

Undo on a user prompt reverts **two layers**:

1. **Transcript** — later `session_messages` are soft-deleted (`deleted_at`). UI and LLM history omit them.
2. **Workspace files** — each member git root is restored to a hidden-ref checkpoint taken at the **start** of that prompt’s turn (`write-tree` + `commit-tree` + `refs/forge/checkpoints/<turnId>`), then `git reset --hard` + `git clean -fd` in the same session worktree.

Chat revert does not require git. File restore does. Forge initializes member folders that are not already git repos at **sandbox provision**. There is no non-git file snapshot (no copy/tarball/overlay).

## Motivation

Today `DELETE /api/sessions/:id/messages/from/:messageId` hard-deletes that row and later rows, then a new turn appends the edited prompt. The LLM prefix is correct **if** delete succeeded. The session worktree is untouched, so agent file edits from later turns stay dirty. Users expect Undo to roll back files as well as chat.

File tools do not `git commit`. Without a per-turn snapshot there is no SHA for “files when this prompt was sent.”

## Goals

1. Soft-delete messages from the chosen user prompt onward; do not `DELETE` rows.
2. Snapshot each member git root at the start of every interactive turn without moving `HEAD`.
3. On revert, restore those roots to the snapshot, then hide messages, then send the edited prompt.
4. At provision, `git init` + initial commit any `/workspace/<member>/` that is not a repo (so `commit-tree -p HEAD` has a parent).
5. Keep Undo available when git is missing; skip file restore for that folder.

## Non-goals

- Restarting `preview_start` after restore (running `next dev` / Vite may go stale).
- Non-git snapshots (copy the tree, tarball, overlay).
- Cloning the source worktree when branching a chat (see `docs/tech-debt.md`).
- Pushing `refs/forge/*`, committing on `main`, or `git clean -fdx` (would wipe `node_modules`).
- Undelete UI.

## Concepts

| Term              | Definition                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Live messages** | `session_messages` with `deleted_at IS NULL`. UI list, LLM `loadChatMessages`, and branch `copyUntil` use only these.             |
| **Hidden ref**    | `refs/forge/checkpoints/<turnId>` pointing at a commit object. Not the session branch; not shown by `git log` on `HEAD`.          |
| **Checkpoint**    | `git add -A` → `write-tree` → `commit-tree -p HEAD` → `update-ref` → mixed `git reset HEAD`. `HEAD` / `workbench-…` do not move.  |
| **Restore**       | In the **same** worktree: `git reset --hard <sha>` then `git clean -fd`. This **does** move the session branch to the checkpoint. |

## Transcript

Add `deleted_at timestamptz null` on `session_messages`.

Revert sets `deleted_at` on message **M** and every later live row (order `createdAt, id`). New edited prompt is a **new** row. `chat_turns` / chunks stay for audit and are not sent to the model.

`partsToModelMessages` is unchanged: it only sees the filtered list.

## Workspace checkpoint

After `ensureChatSandbox` and appending the user message, before tools:

```text
git add -A
tree=$(git write-tree)
commit=$(git commit-tree "$tree" -p HEAD -m "forge-checkpoint ${TURN_ID}")
git update-ref "refs/forge/checkpoints/${TURN_ID}" "$commit"
git reset HEAD
```

Author/committer: Forge Agent (`forge@local`). Skip a root that is not a git repo or has no `HEAD`. Store `{ repoName: sha }` on `chat_turns.workspace_checkpoint`.

```text
  C0  <--  workbench-T (HEAD)
   \
    Ckpt2  <--  refs/forge/checkpoints/turn2

  working tree still matches Ckpt2 (turn-1 dirty files); turn-2 edits are not in Ckpt2
```

Revert of M2: `reset --hard Ckpt2` + `clean -fd`, then soft-delete from M2, then send M2′. The new turn takes its own checkpoint.

## Provision git init

Every member mount `/workspace/<repoName>` must be a git repo with `HEAD` after provision.

- Local connect already calls `ensureCanonicalGitRepo`.
- `ensureWorkspaceMemberCopy` must call that helper instead of throwing when canonical is not a repo.
- After mount/clone, if a member dir is still not a repo (or has no `HEAD`), init + `forge: initial import`.
- Do not `git init` nested folders or `/workspace` itself.

If init still fails, revert skips files for that folder and still hides messages.

## Restore policy

| Situation                         | Files     | Messages                       |
| --------------------------------- | --------- | ------------------------------ |
| Git root + SHA, reset succeeds    | Restored  | Soft-deleted                   |
| Git root + SHA, reset/clean fails | Unchanged | **Not** hidden (request fails) |
| Not a git repo, or no checkpoint  | Unchanged | Soft-deleted                   |

Do not hide Undo. Do not fail the whole request merely because a member has no git.

## API

`DELETE /api/sessions/:sessionId/messages/from/:messageId` (unchanged URL):

1. 404 if M is missing or already hidden.
2. Restore from `M.turnId`’s `workspace_checkpoint` when SHAs exist.
3. Soft-delete M and later live rows.
4. `{ deleted, workspaceRestored }`.

`POST /internal/chat/turns/:turnId/checkpoint` `{ sessionId }` writes the jsonb map.

## Out of scope (accepted)

- Preview process restart after restore.
- Branch-chat worktree clone (document in `docs/tech-debt.md`).
