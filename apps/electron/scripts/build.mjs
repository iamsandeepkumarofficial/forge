import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("tsc -p tsconfig.build.json", { cwd: pkg, stdio: "inherit" });
mkdirSync(join(pkg, "dist"), { recursive: true });
copyFileSync(join(pkg, "src/preload.cjs"), join(pkg, "dist/preload.cjs"));
