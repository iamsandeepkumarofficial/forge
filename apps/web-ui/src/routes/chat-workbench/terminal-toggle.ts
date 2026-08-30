export const TERMINAL_TOGGLE_EVENT = "forge-terminal-toggle";
export const PREVIEW_DOCK_EVENT = "forge-preview-dock";

export type PreviewDockMode = "terminal" | "devtools";

export function requestPreviewDock(mode: PreviewDockMode): void {
  window.dispatchEvent(
    new CustomEvent(PREVIEW_DOCK_EVENT, { detail: { mode } })
  );
}

export function requestTerminalToggle(): void {
  requestPreviewDock("terminal");
}

export function requestDevtoolsToggle(): void {
  requestPreviewDock("devtools");
}

export function dockModeFromEvent(event: Event): PreviewDockMode {
  const mode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
  return mode === "devtools" ? "devtools" : "terminal";
}
