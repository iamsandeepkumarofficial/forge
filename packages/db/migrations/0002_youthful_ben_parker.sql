CREATE TYPE "public"."chat_feature_type" AS ENUM('feature', 'bug', 'refactor');--> statement-breakpoint
ALTER TABLE "chat_features" ADD COLUMN "type" "chat_feature_type" DEFAULT 'feature' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_features" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_features" ADD CONSTRAINT "chat_features_parent_id_chat_features_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chat_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_features_parent_id_idx" ON "chat_features" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "chat_features" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."chat_features" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."chat_feature_status";--> statement-breakpoint
CREATE TYPE "public"."chat_feature_status" AS ENUM('no_section', 'planning', 'development', 'qa', 'done');--> statement-breakpoint
ALTER TABLE "public"."chat_features" ALTER COLUMN "status" SET DATA TYPE "public"."chat_feature_status" USING "status"::"public"."chat_feature_status";--> statement-breakpoint
ALTER TABLE "chat_features" ALTER COLUMN "status" SET DEFAULT 'no_section';