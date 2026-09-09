DO $$ BEGIN
  CREATE TYPE "public"."execution_target" AS ENUM('local', 'cloud');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "chat_features"
  ADD COLUMN IF NOT EXISTS "execution_target" "execution_target" DEFAULT 'local' NOT NULL;
