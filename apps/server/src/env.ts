import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const serverRoot = path.resolve(here, "..");

config({ path: path.join(repoRoot, ".env"), override: true });
config({ path: path.join(serverRoot, ".env"), override: true });
