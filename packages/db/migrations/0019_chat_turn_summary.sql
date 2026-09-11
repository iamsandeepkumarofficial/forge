ALTER TABLE "chat_turns"
  ADD COLUMN IF NOT EXISTS "rounds" integer,
  ADD COLUMN IF NOT EXISTS "tool_call_count" integer,
  ADD COLUMN IF NOT EXISTS "tool_names" jsonb,
  ADD COLUMN IF NOT EXISTS "hit_round_cap" boolean;
