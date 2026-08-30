import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureElectron } from "./electron-binary.mjs";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = spawnSync(process.execPath, [join(pkg, "scripts/build.mjs")], {
  cwd: pkg,
  stdio: "inherit"
});
if (built.status !== 0) {
  process.exit(built.status ?? 1);
}

const electronBin = ensureElectron();
const child = spawn(electronBin, ["."], {
  cwd: pkg,
  stdio: "inherit",
  env: process.env
});
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
