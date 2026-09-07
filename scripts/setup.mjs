import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function ensureNodePtySpawnHelper() {
  try {
    const require = createRequire(path.join(root, "apps/server/package.json"));
    const pkgDir = path.dirname(require.resolve("node-pty/package.json"));
    const prebuilds = path.join(pkgDir, "prebuilds");
    if (!fs.existsSync(prebuilds)) return;
    for (const plat of fs.readdirSync(prebuilds)) {
      const helper = path.join(prebuilds, plat, "spawn-helper");
      if (!fs.existsSync(helper)) continue;
      fs.chmodSync(helper, 0o755);
    }
  } catch {
    void 0;
  }
}

ensureNodePtySpawnHelper();
console.log("[setup] ready");
