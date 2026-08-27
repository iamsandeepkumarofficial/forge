-- Workspace layer: group multiple single-repo projects (many-to-many).
-- Workspace-scoped chats mount all member repos under /workspace/{repoName}.

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "routes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_user_id_idx" ON "workspaces" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "repo_name" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "env" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_projects_workspace_id_project_id_unique" UNIQUE("workspace_id","project_id"),
  CONSTRAINT "workspace_projects_workspace_id_repo_name_unique" UNIQUE("workspace_id","repo_name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_projects_workspace_id_idx"
  ON "workspace_projects" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_projects_project_id_idx"
  ON "workspace_projects" USING btree ("project_id");
--> statement-breakpoint
ALTER TABLE "chat_features" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_features"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid
  REFERENCES "workspaces"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "chat_features"
  ADD CONSTRAINT "chat_features_workspace_id_branch_unique"
  UNIQUE("workspace_id","branch_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_features_workspace_kind_activity_idx"
  ON "chat_features" USING btree ("workspace_id", "kind", "last_activity_at");
--> statement-breakpoint
ALTER TABLE "chat_features"
  ADD CONSTRAINT "chat_features_project_or_workspace_check"
  CHECK (
    ("project_id" IS NOT NULL AND "workspace_id" IS NULL)
    OR ("project_id" IS NULL AND "workspace_id" IS NOT NULL)
  );
