import type { ForgeDesktopPreview } from "./desktop-preview.js";

declare global {
  interface Window {
    forgeDesktop?: {
      pickFolder: () => Promise<string | null>;
      getStatus?: () => Promise<string>;
      preview?: ForgeDesktopPreview;
    };
  }
}

export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.forgeDesktop);
}

export function isElectronPreview(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.forgeDesktop?.preview);
}

export function electronPreview(): ForgeDesktopPreview | null {
  return window.forgeDesktop?.preview ?? null;
}

export async function pickFolder(): Promise<string | null> {
  if (window.forgeDesktop?.pickFolder) {
    return window.forgeDesktop.pickFolder();
  }
  return null;
}
