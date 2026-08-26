declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

/** True when running inside the Forge Tauri desktop shell. */
export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

/**
 * Open a native folder picker (desktop only).
 * Returns an absolute path, or null if cancelled / not desktop.
 * Lazy-imports the Tauri dialog plugin so browser builds stay intact.
 */
export async function pickFolder(): Promise<string | null> {
  if (!isDesktop()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  if (selected === null || Array.isArray(selected)) return null;
  return selected;
}
