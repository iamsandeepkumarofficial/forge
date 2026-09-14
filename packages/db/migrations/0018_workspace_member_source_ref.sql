ALTER TABLE "workspace_projects"
  ADD COLUMN IF NOT EXISTS "source_ref" varchar(255);
