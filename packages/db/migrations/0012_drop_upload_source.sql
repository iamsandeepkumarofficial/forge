-- RFC 0004: drop upload project source; local folder copies replace ZIP/MinIO.
UPDATE "projects" SET "source" = 'local' WHERE "source" = 'upload';

ALTER TABLE "projects" ALTER COLUMN "source" TYPE text;
DROP TYPE "public"."project_source";
CREATE TYPE "public"."project_source" AS ENUM('github', 'local');
ALTER TABLE "projects"
  ALTER COLUMN "source" TYPE "public"."project_source"
  USING "source"::"public"."project_source";
