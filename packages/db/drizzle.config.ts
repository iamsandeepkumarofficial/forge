import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(here, ".env"), override: true });

export default defineConfig({
  schema: ["./src/schema.ts", "./src/schemaWorkflow.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5433/forge"
  },
  verbose: true,
  strict: true
});
