CREATE TABLE IF NOT EXISTS "workspace_environments" (
  "workspace_id" uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "launch" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source_session_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
