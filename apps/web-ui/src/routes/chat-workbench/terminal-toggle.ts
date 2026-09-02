export const TERMINAL_TOGGLE_EVENT = "forge-terminal-toggle";
export const PREVIEW_DOCK_EVENT = "forge-preview-dock";
export const OPEN_TERMINAL_JOB_EVENT = "forge-open-terminal-job";
export const OPEN_TERMINAL_TAB_EVENT = "forge-open-terminal-tab";

export type PreviewDockMode = "terminal" | "devtools";

export type OpenTerminalTabDetail = {
  id: string;
  kind: "app" | "job";
};

export function requestPreviewDock(
  mode: PreviewDockMode,
  options?: { ensure?: boolean }
): void {
  window.dispatchEvent(
    new CustomEvent(PREVIEW_DOCK_EVENT, {
      detail: { mode, ensure: options?.ensure === true }
    })
  );
}

export function requestTerminalToggle(): void {
  requestPreviewDock("terminal");
}

export function requestDevtoolsToggle(): void {
  requestPreviewDock("devtools");
}

export function requestOpenTerminalTab(detail: OpenTerminalTabDetail): void {
  const id = detail.id.trim();
  if (!id || (detail.kind !== "app" && detail.kind !== "job")) return;
  requestPreviewDock("terminal", { ensure: true });
  window.dispatchEvent(
    new CustomEvent(OPEN_TERMINAL_TAB_EVENT, {
      detail: { id, kind: detail.kind }
    })
  );
}

export function requestOpenTerminalJob(jobName: string): void {
  const name = jobName.trim();
  if (!name) return;
  requestOpenTerminalTab({ id: `job:${name}`, kind: "job" });
}

export function dockModeFromEvent(event: Event): PreviewDockMode {
  const mode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
  return mode === "devtools" ? "devtools" : "terminal";
}

export function dockEnsureFromEvent(event: Event): boolean {
  return (event as CustomEvent<{ ensure?: unknown }>).detail?.ensure === true;
}

export function jobNameFromOpenEvent(event: Event): string | null {
  const name = (event as CustomEvent<{ jobName?: unknown }>).detail?.jobName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export function terminalTabFromOpenEvent(
  event: Event
): OpenTerminalTabDetail | null {
  const detail = (event as CustomEvent<Partial<OpenTerminalTabDetail>>).detail;
  const id = typeof detail?.id === "string" ? detail.id.trim() : "";
  const kind = detail?.kind;
  if (!id || (kind !== "app" && kind !== "job")) return null;
  return { id, kind };
}
