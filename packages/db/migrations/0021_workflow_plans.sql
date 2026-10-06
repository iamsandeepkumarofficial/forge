CREATE TYPE "public"."workflow_plan_status" AS ENUM(
  'planned',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled'
);--> statement-breakpoint
CREATE TYPE "public"."workflow_task_status" AS ENUM(
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled'
);--> statement-breakpoint
CREATE TYPE "public"."workflow_task_executor" AS ENUM(
  'agent',
  'tool',
  'human'
);--> statement-breakpoint
CREATE TABLE "workflow_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL,
  "turn_id" uuid NOT NULL,
  "workflow_id" text NOT NULL,
  "goal" text NOT NULL,
  "status" "workflow_plan_status" DEFAULT 'planned' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "replan_count" integer DEFAULT 0 NOT NULL,
  "queued_follow_up" jsonb,
  "working_ms" integer DEFAULT 0 NOT NULL,
  "llm_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd" numeric(12, 4) DEFAULT '0' NOT NULL,
  "budget_stop_reason" varchar(16),
  "snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_plans_turn_id_unique" UNIQUE("turn_id")
);--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
  "plan_id" uuid NOT NULL,
  "id" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "description" text NOT NULL,
  "executor" "workflow_task_executor" DEFAULT 'agent' NOT NULL,
  "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "workflow_task_status" DEFAULT 'pending' NOT NULL,
  "idempotent" boolean DEFAULT false NOT NULL,
  "wait_reason" jsonb,
  "input" jsonb,
  "output" jsonb,
  "error" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "child_workflow_id" text,
  "worktree_path" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  CONSTRAINT "workflow_tasks_plan_version_id_unique" UNIQUE("plan_id", "version", "id")
);--> statement-breakpoint
ALTER TABLE "workflow_plans"
  ADD CONSTRAINT "workflow_plans_turn_id_chat_turns_id_fk"
  FOREIGN KEY ("turn_id") REFERENCES "public"."chat_turns"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks"
  ADD CONSTRAINT "workflow_tasks_plan_id_workflow_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."workflow_plans"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_plans_session_id_status_idx"
  ON "workflow_plans" USING btree ("session_id", "status");--> statement-breakpoint
CREATE INDEX "workflow_tasks_plan_id_version_idx"
  ON "workflow_tasks" USING btree ("plan_id", "version");--> statement-breakpoint
CREATE INDEX "workflow_tasks_status_idx"
  ON "workflow_tasks" USING btree ("status");
