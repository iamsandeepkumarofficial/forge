import { ensureElectron, platformElectronPath } from "./electron-binary.mjs";

ensureElectron();
process.stderr.write(`[forge-electron] electron ready (${platformElectronPath()})\n`);
