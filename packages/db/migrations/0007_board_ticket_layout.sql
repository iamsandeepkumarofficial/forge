ALTER TABLE "chat_features" ADD COLUMN IF NOT EXISTS "description" jsonb;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."chat_activity_kind" AS ENUM('history', 'worklog');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."chat_activity_actor" AS ENUM('agent', 'builder', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_feature_id" uuid NOT NULL,
	"file_name" varchar(512) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_linked_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_feature_id" uuid NOT NULL,
	"label" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"external_key" varchar(255),
	"provider" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_feature_id" uuid NOT NULL,
	"kind" "chat_activity_kind" NOT NULL,
	"actor_type" "chat_activity_actor" NOT NULL,
	"agent_id" varchar(128),
	"user_id" uuid,
	"summary" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_chat_feature_id_chat_features_id_fk" FOREIGN KEY ("chat_feature_id") REFERENCES "public"."chat_features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_linked_items" ADD CONSTRAINT "chat_linked_items_chat_feature_id_chat_features_id_fk" FOREIGN KEY ("chat_feature_id") REFERENCES "public"."chat_features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_activities" ADD CONSTRAINT "chat_activities_chat_feature_id_chat_features_id_fk" FOREIGN KEY ("chat_feature_id") REFERENCES "public"."chat_features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_attachments_chat_feature_id_idx" ON "chat_attachments" USING btree ("chat_feature_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_linked_items_chat_feature_id_idx" ON "chat_linked_items" USING btree ("chat_feature_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_activities_chat_feature_id_created_at_idx" ON "chat_activities" USING btree ("chat_feature_id","created_at");
