ALTER TABLE "chat_features" ADD COLUMN IF NOT EXISTS "workflow_id" varchar(128) DEFAULT 'sdlc' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_source" AS ENUM('user', 'agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" varchar(512) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"source" "document_source" DEFAULT 'user' NOT NULL,
	"agent_id" varchar(128),
	"chat_feature_id" uuid,
	"stage_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_user_id_idx" ON "documents" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_user_id_project_id_idx" ON "documents" USING btree ("user_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_chat_feature_id_idx" ON "documents" USING btree ("chat_feature_id");
