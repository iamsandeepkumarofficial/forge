import { WebContentsView } from "electron";
import type { HostedView } from "./previewHost.js";
import { PREVIEW_PARTITION } from "./types.js";

export function createPreviewView(): HostedView {
  return new WebContentsView({
    webPreferences: {
      partition: PREVIEW_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  }) as unknown as HostedView;
}

export function createDevtoolsView(): HostedView {
  return new WebContentsView({
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  }) as unknown as HostedView;
}
