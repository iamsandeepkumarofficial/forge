CREATE TABLE IF NOT EXISTS "user_github_accounts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "github_user_id" varchar(64) NOT NULL,
  "github_login" varchar(255) NOT NULL,
  "access_token" text NOT NULL,
  "scope" text,
  "token_type" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_github_accounts" ADD CONSTRAINT "user_github_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_github_accounts_login_idx" ON "user_github_accounts" USING btree ("github_login");
