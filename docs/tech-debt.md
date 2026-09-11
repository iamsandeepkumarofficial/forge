# Tech debt

Known follow-ups that are intentionally not in the current work. For product ideas that are not bugs, see [upcoming-features.md](./upcoming-features.md). For QA notes, see [qa-backlog.md](./qa-backlog.md).

## Branch chat does not copy workspace files

**Status:** open — revisit in a later chat (2026-09-11)

**Problem:** Branch shipped with [RFC 0010](./rfcs/0010-interactive-chat-revert.md) and the workbench message actions, but the branched session does not get the source chat’s files.

[`branchChatFromMessage`](../apps/web-ui/src/routes/chat-workbench/branch-chat.ts) creates a workspace or project chat, then [`copyUntil`](../apps/server/src/catalog/sessionChatRepository.ts) copies live messages through the chosen assistant turn (`POST /api/sessions/:id/branch`).

That is **transcript-only**. The new session provisions a **fresh** sandbox from canonical / GitHub default. Files do not match the copied conversation. The source session’s dirty tree and per-turn touched-file checkpoint blobs are ignored.

**Follow-up:** When branching from a message whose turn has a `workspace_checkpoint` sidecar, copy those blobs (and later-turn earliest-`before` restore) into the new session workspace so `/workspace/<member>/` matches the conversation that was copied. Also re-verify the transcript copy / navigation path; it is not trustworthy today.

**Related:** RFC 0005 (session worktrees), RFC 0010 (touched-file checkpoints).
