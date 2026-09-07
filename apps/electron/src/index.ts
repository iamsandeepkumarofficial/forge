import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HEALTH_ATTEMPTS,
  IPC_GET_STATUS,
  IPC_PICK_FOLDER,
  WEB_UI_URL
} from "./types.js";
import { waitForHttp } from "./httpWait.js";
import { findRepoRoot } from "./repoRoot.js";
import { Supervisor } from "./supervisor.js";
import { ensureWebUi } from "./webUi.js";
import { browserWindowOptions } from "./window.js";
import { attachPreviewHost, registerPreviewIpc } from "./previewIpc.js";

const supervisor = new Supervisor();
let quitting = false;

process.env.FORGE_DESKTOP = "1";
if (!process.env.SANDBOX_RUNTIME?.trim()) {
  process.env.SANDBOX_RUNTIME = "host";
}

const here = path.dirname(fileURLToPath(import.meta.url));

app.whenReady().then(() => {
  void boot();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void supervisor.stopInfra().finally(() => {
    app.exit(0);
  });
});

async function boot(): Promise<void> {
  const root = findRepoRoot({
    startDirs: [process.cwd(), path.resolve(here, "..", "..", "..")]
  });
  try {
    const vite = await ensureWebUi({ root });
    if (vite) supervisor.track(vite);
  } catch (err) {
    process.stderr.write(`[forge-electron] vite: ${String(err)}\n`);
  }
  void supervisor
    .startInfra()
    .then((msg) => {
      process.stderr.write(`[forge-electron] ${msg}\n`);
    })
    .catch((err: unknown) => {
      process.stderr.write(
        `[forge-electron] start_infra failed: ${String(err)}\n`
      );
    });
  await createWindow();
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow(
    browserWindowOptions(path.join(here, "preload.cjs"))
  );
  registerPreviewIpc();
  attachPreviewHost(win);
  bindIpc(win);
  try {
    await waitForHttp({ url: WEB_UI_URL, attempts: HEALTH_ATTEMPTS });
    await win.loadURL(WEB_UI_URL);
  } catch (err) {
    process.stderr.write(`[forge-electron] load UI failed: ${String(err)}\n`);
    await win.loadURL(WEB_UI_URL).catch(() => undefined);
  }
  return win;
}

function bindIpc(win: BrowserWindow): void {
  ipcMain.removeHandler(IPC_PICK_FOLDER);
  ipcMain.removeHandler(IPC_GET_STATUS);
  ipcMain.handle(IPC_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle(IPC_GET_STATUS, () => supervisor.getStatus());
}
