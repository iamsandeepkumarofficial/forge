CREATE TABLE "chat_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_feature_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_comments" ADD CONSTRAINT "chat_comments_chat_feature_id_chat_features_id_fk" FOREIGN KEY ("chat_feature_id") REFERENCES "public"."chat_features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_comments_chat_feature_id_idx" ON "chat_comments" USING btree ("chat_feature_id");