DO $$ BEGIN
  CREATE TYPE "public"."chat_feature_kind" AS ENUM('ticket', 'workbench');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "chat_features" ADD COLUMN IF NOT EXISTS "kind" "chat_feature_kind" DEFAULT 'ticket' NOT NULL;

UPDATE "chat_features" SET "kind" = 'ticket' WHERE "kind" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_features_project_kind_activity_idx"
  ON "chat_features" ("project_id", "kind", "last_activity_at" DESC);
