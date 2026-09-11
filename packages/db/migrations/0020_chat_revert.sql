ALTER TABLE "session_messages"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

ALTER TABLE "chat_turns"
  ADD COLUMN IF NOT EXISTS "workspace_checkpoint" jsonb;
