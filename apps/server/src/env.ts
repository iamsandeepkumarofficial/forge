import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const serverRoot = path.resolve(here, "..");
// override: true so repo .env wins over a stale shell DATABASE_URL export
config({ path: path.join(repoRoot, ".env"), override: true });
config({ path: path.join(serverRoot, ".env"), override: true });
