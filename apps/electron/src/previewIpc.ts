import {
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent
} from "electron";
import { createDevtoolsView, createPreviewView } from "./electronViews.js";
import { PreviewHost, type PreviewWindow } from "./previewHost.js";
import { popupPreviewOverflowMenu } from "./previewOverflowMenu.js";
import {
  IPC_PREVIEW_CANCEL_PICK,
  IPC_PREVIEW_CAPTURE,
  IPC_PREVIEW_CLEAR,
  IPC_PREVIEW_DT_BOUNDS,
  IPC_PREVIEW_DT_VISIBLE,
  IPC_PREVIEW_GO_BACK,
  IPC_PREVIEW_GO_FORWARD,
  IPC_PREVIEW_LOAD,
  IPC_PREVIEW_OVERFLOW_MENU,
  IPC_PREVIEW_RELOAD,
  IPC_PREVIEW_SET_BOUNDS,
  IPC_PREVIEW_SET_VISIBLE,
  IPC_PREVIEW_SET_ZOOM,
  IPC_PREVIEW_START_PICK
} from "./types.js";
import { parseCaptureRect, type ViewBounds } from "./viewBounds.js";

const hosts = new Map<number, PreviewHost>();

export function attachPreviewHost(win: BrowserWindow): PreviewHost {
  const host = new PreviewHost(win as unknown as PreviewWindow, {
    createPreview: createPreviewView,
    createDevtools: createDevtoolsView
  });
  hosts.set(win.webContents.id, host);
  win.on("closed", () => {
    hosts.delete(win.webContents.id);
  });
  return host;
}

export function registerPreviewIpc(): void {
  handle(IPC_PREVIEW_SET_BOUNDS, (host, arg) => {
    host.setPreviewBounds(arg as ViewBounds);
  });
  handle(IPC_PREVIEW_SET_VISIBLE, (host, arg) => {
    host.setPreviewVisible(Boolean(arg));
  });
  handle(IPC_PREVIEW_LOAD, async (host, arg) => {
    await host.loadURL(String(arg));
  });
  handle(IPC_PREVIEW_RELOAD, (host, arg) => {
    host.reload(Boolean(arg));
  });
  handle(IPC_PREVIEW_GO_BACK, (host) => {
    host.goBack();
  });
  handle(IPC_PREVIEW_GO_FORWARD, (host) => {
    host.goForward();
  });
  handle(IPC_PREVIEW_SET_ZOOM, (host, arg) => {
    host.setZoom(Number(arg));
  });
  handle(IPC_PREVIEW_DT_BOUNDS, (host, arg) => {
    host.setDevtoolsBounds(arg as ViewBounds);
  });
  handle(IPC_PREVIEW_DT_VISIBLE, (host, arg) => {
    host.setDevtoolsVisible(Boolean(arg));
  });
  handle(IPC_PREVIEW_CAPTURE, async (host, arg) =>
    host.capturePage(parseCaptureRect(arg))
  );
  handle(IPC_PREVIEW_CLEAR, async (host, arg) => {
    await host.clearStorage(String(arg));
  });
  handle(IPC_PREVIEW_START_PICK, async (host) => host.startPick());
  handle(IPC_PREVIEW_CANCEL_PICK, async (host) => {
    await host.cancelPick();
  });
  ipcMain.removeHandler(IPC_PREVIEW_OVERFLOW_MENU);
  ipcMain.handle(IPC_PREVIEW_OVERFLOW_MENU, (event, arg) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    return popupPreviewOverflowMenu(win, arg);
  });
}

function handle(
  channel: string,
  fn: (host: PreviewHost, arg: unknown) => unknown
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, arg: unknown) => {
    const host = hosts.get(event.sender.id);
    if (!host) return undefined;
    return fn(host, arg);
  });
}
