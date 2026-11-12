ALTER TABLE "workflow_tasks"
  ADD COLUMN "input_schema" jsonb NOT NULL DEFAULT '{"schemaVersion":1,"type":"object","additionalProperties":false,"properties":{}}'::jsonb;--> statement-breakpoint
ALTER TABLE "workflow_tasks"
  ADD COLUMN "output_schema" jsonb NOT NULL DEFAULT '{"schemaVersion":1,"type":"object","additionalProperties":false,"properties":{}}'::jsonb;--> statement-breakpoint
ALTER TABLE "workflow_tasks"
  ADD COLUMN "input_mappings" jsonb NOT NULL DEFAULT '[]'::jsonb;
