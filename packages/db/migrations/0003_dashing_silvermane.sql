CREATE TYPE "public"."chat_feature_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
ALTER TABLE "chat_features" ADD COLUMN "priority" "chat_feature_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_features" ADD COLUMN "due_date" timestamp with time zone;