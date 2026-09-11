# Tech debt

Known follow-ups that are intentionally not in the current work. For product ideas that are not bugs, see [upcoming-features.md](./upcoming-features.md). For QA notes, see [qa-backlog.md](./qa-backlog.md).

## Branch chat and revert-to-checkpoint do not work correctly

**Status:** open — revisit in a later chat (2026-09-11)

**Problem:** Branch and Undo / revert-to-checkpoint shipped with [RFC 0010](./rfcs/0010-interactive-chat-revert.md) and the workbench message actions, but **neither flow is correct in the product**. Do not treat them as done. Diagnose and fix in a dedicated chat.

### Branch

[`branchChatFromMessage`](../apps/web-ui/src/routes/chat-workbench/branch-chat.ts) creates a workspace or project chat, then [`copyUntil`](../apps/server/src/catalog/sessionChatRepository.ts) copies live messages through the chosen assistant turn (`POST /api/sessions/:id/branch`).

That is **transcript-only**. The new session provisions a **fresh** sandbox from canonical / GitHub default. Files do not match the copied conversation. The source session’s dirty tree and per-turn hidden-ref checkpoints are ignored.

**Follow-up:** When branching from a message whose turn has `workspace_checkpoint`, clone (or `git worktree add`) each source member worktree at that SHA so `/workspace/<member>/` matches the copied history. Also re-verify the transcript copy / navigation path; it is not trustworthy today.

**Related:** RFC 0005 (session worktrees), RFC 0010 (hidden-ref checkpoints).

### Revert to checkpoint

RFC 0010: Undo on a user prompt should restore member git roots to `refs/forge/checkpoints/<turnId>` (`git reset --hard` + `git clean -fd`), then soft-delete that prompt and later live `session_messages` (`deleted_at`), then send the edited prompt.

The plumbing exists (`workspaceCheckpoint.ts`, migration `0020_chat_revert.sql`, `DELETE /api/sessions/:id/messages/from/:messageId`), but **checkpoint write and/or restore does not behave correctly in use**. Files and transcript can disagree with the prompt being reverted.

**Follow-up:** Confirm checkpoints are taken at turn start on every member, restore uses those SHAs in the **same** worktree, and the UI only offers Undo when the operation can succeed. Non-goals in the RFC stay (no preview restart, no non-git snapshot).
