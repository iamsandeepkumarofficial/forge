CREATE TABLE IF NOT EXISTS "project_parameters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "key" varchar(255) NOT NULL,
  "value" text NOT NULL,
  "secret" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_parameters_project_id_key_unique"
  ON "project_parameters" ("project_id", "key");

CREATE INDEX IF NOT EXISTS "project_parameters_project_id_idx"
  ON "project_parameters" ("project_id");

CREATE TABLE IF NOT EXISTS "workspace_parameters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "key" varchar(255) NOT NULL,
  "value" text NOT NULL,
  "secret" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_parameters_workspace_id_key_unique"
  ON "workspace_parameters" ("workspace_id", "key");

CREATE INDEX IF NOT EXISTS "workspace_parameters_workspace_id_idx"
  ON "workspace_parameters" ("workspace_id");

CREATE TABLE IF NOT EXISTS "workspace_health" (
  "workspace_id" uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "status" varchar(32) NOT NULL DEFAULT 'computing',
  "report" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
