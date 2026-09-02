import type { TmuxWindow } from "./sessionPty.js";

export type TerminalTabKind = "shell" | "app";

export type TerminalTab = {
  id: string;
  kind: TerminalTabKind;
  label: string;
  running: boolean;
  closable: boolean;
  stoppable?: boolean;
};

export function mergeTerminalTabs(options: {
  shells: TmuxWindow[];
  apps: Array<{ name: string; running: boolean }>;
}): TerminalTab[] {
  const tabs: TerminalTab[] = options.shells.map((shell) => ({
    id: shell.name,
    kind: "shell",
    label: shell.name === "main" ? "Shell" : shell.name,
    running: false,
    closable: shell.name !== "main" || options.shells.length > 1
  }));
  for (const app of options.apps) {
    const slash = app.name.lastIndexOf("/");
    const label = slash >= 0 ? app.name.slice(slash + 1) : app.name;
    tabs.push({
      id: `app:${app.name}`,
      kind: "app",
      label,
      running: app.running,
      closable: true,
      stoppable: app.running
    });
  }
  return tabs;
}
