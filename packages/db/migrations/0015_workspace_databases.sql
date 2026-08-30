CREATE TABLE IF NOT EXISTS "workspace_databases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "engine_id" varchar(64) NOT NULL,
  "database_name" varchar(128) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_databases_workspace_id_engine_id_unique"
  ON "workspace_databases" ("workspace_id", "engine_id");

CREATE INDEX IF NOT EXISTS "workspace_databases_workspace_id_idx"
  ON "workspace_databases" ("workspace_id");
