CREATE TYPE "public"."chat_turn_status" AS ENUM('running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."session_message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TABLE "session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"role" "session_message_role" NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"turn_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"status" "chat_turn_status" DEFAULT 'running' NOT NULL,
	"mode" varchar(16) DEFAULT 'build' NOT NULL,
	"provider" varchar(32),
	"model" varchar(128),
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "chat_turns_workflow_id_unique" UNIQUE("workflow_id")
);
--> statement-breakpoint
CREATE TABLE "chat_turn_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_turn_chunks_turn_id_seq_unique" UNIQUE("turn_id","seq")
);
--> statement-breakpoint
ALTER TABLE "chat_turn_chunks" ADD CONSTRAINT "chat_turn_chunks_turn_id_chat_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."chat_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_messages_session_id_created_at_idx" ON "session_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_turns_session_id_status_idx" ON "chat_turns" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "chat_turn_chunks_turn_id_seq_idx" ON "chat_turn_chunks" USING btree ("turn_id","seq");
