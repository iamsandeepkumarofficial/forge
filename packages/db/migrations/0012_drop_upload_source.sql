-- RFC 0004: drop upload project source; local folder copies replace ZIP/MinIO.
-- Cast to text before rewriting values so we never use a newly-added enum label
-- in the same migrate transaction (Postgres 55P04).
ALTER TABLE "projects" ALTER COLUMN "source" TYPE text USING "source"::text;
UPDATE "projects" SET "source" = 'local' WHERE "source" = 'upload';
DROP TYPE "public"."project_source";
CREATE TYPE "public"."project_source" AS ENUM('github', 'local');
ALTER TABLE "projects"
  ALTER COLUMN "source" TYPE "public"."project_source"
  USING "source"::"public"."project_source";
