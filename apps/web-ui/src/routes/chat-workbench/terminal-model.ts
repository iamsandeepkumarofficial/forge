export type TerminalTabKind = "shell" | "app" | "job";

export type TerminalTab = {
  id: string;
  kind: TerminalTabKind;
  label: string;
  running: boolean;
  closable: boolean;
  stoppable?: boolean;
};

export function appLogsByStream(
  appLogs: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, text] of Object.entries(appLogs)) {
    next[`app:${name}`] = text;
  }
  return next;
}

export function jobTabId(jobName: string): string {
  return `job:${jobName}`;
}

export function jobNameFromTabId(tabId: string): string {
  return tabId.startsWith("job:") ? tabId.slice(4) : tabId;
}

export function pinnedJobTab(jobName: string, running = true): TerminalTab {
  return {
    id: jobTabId(jobName),
    kind: "job",
    label: jobName,
    running,
    closable: true,
    stoppable: running
  };
}

export function appTab(appName: string, running = true): TerminalTab {
  const slash = appName.lastIndexOf("/");
  const label = slash >= 0 ? appName.slice(slash + 1) : appName;
  return {
    id: `app:${appName}`,
    kind: "app",
    label,
    running,
    closable: true,
    stoppable: running
  };
}

export function appNameFromTabId(tabId: string): string {
  return tabId.startsWith("app:") ? tabId.slice(4) : tabId;
}

export function mergeShellTab(
  tabs: TerminalTab[],
  tab: TerminalTab
): TerminalTab[] {
  if (tabs.some((entry) => entry.id === tab.id)) {
    return tabs.map((entry) => (entry.id === tab.id ? tab : entry));
  }
  return [...tabs, tab];
}

export function mergeApiTabsWithPinnedJobs(options: {
  apiTabs: TerminalTab[];
  previous: TerminalTab[];
  jobRunning?: Record<string, boolean>;
}): TerminalTab[] {
  const jobs = options.previous.filter((tab) => tab.kind === "job");
  const nextJobs = jobs.map((tab) => {
    const name = jobNameFromTabId(tab.id);
    const running = options.jobRunning?.[name];
    if (running === undefined) return tab;
    return { ...tab, running, stoppable: running };
  });
  return [...options.apiTabs.filter((tab) => tab.kind !== "job"), ...nextJobs];
}

export function applyTrackedRunningState(
  tabs: TerminalTab[],
  options: { trackedApps: string[]; trackedJobs: string[] }
): TerminalTab[] {
  const trackedApps = new Set(options.trackedApps);
  const trackedJobs = new Set(options.trackedJobs);
  const shells = tabs.filter((tab) => tab.kind === "shell");
  const appMap = new Map<string, TerminalTab>();
  for (const tab of tabs) {
    if (tab.kind !== "app") continue;
    appMap.set(appNameFromTabId(tab.id), tab);
  }
  for (const name of trackedApps) {
    const existing = appMap.get(name);
    appMap.set(
      name,
      existing
        ? { ...existing, running: true, stoppable: true }
        : appTab(name, true)
    );
  }
  for (const [name, tab] of appMap) {
    if (trackedApps.has(name)) continue;
    if (!tab.running && !tab.stoppable) continue;
    appMap.set(name, { ...tab, running: false, stoppable: false });
  }
  const jobMap = new Map<string, TerminalTab>();
  for (const tab of tabs) {
    if (tab.kind !== "job") continue;
    jobMap.set(jobNameFromTabId(tab.id), tab);
  }
  for (const name of trackedJobs) {
    const existing = jobMap.get(name);
    jobMap.set(
      name,
      existing
        ? { ...existing, running: true, stoppable: true }
        : pinnedJobTab(name, true)
    );
  }
  for (const name of [...jobMap.keys()]) {
    if (!trackedJobs.has(name)) jobMap.delete(name);
  }
  return [...shells, ...appMap.values(), ...jobMap.values()];
}

export function countRunningTabs(tabs: TerminalTab[]): number {
  return tabs.filter(
    (tab) => tab.running && (tab.kind === "app" || tab.kind === "job")
  ).length;
}

export function pickActiveTab(options: {
  tabs: TerminalTab[];
  preferredId: string | null;
  hidden: ReadonlySet<string>;
}): string | null {
  const visible = options.tabs.filter((tab) => !options.hidden.has(tab.id));
  if (visible.length === 0) return null;
  if (
    options.preferredId &&
    visible.some((tab) => tab.id === options.preferredId)
  ) {
    return options.preferredId;
  }
  const shell = visible.find((tab) => tab.kind === "shell");
  return shell?.id ?? visible[0]!.id;
}

export function visibleTabs(
  tabs: TerminalTab[],
  hidden: ReadonlySet<string>
): TerminalTab[] {
  return tabs.filter((tab) => !hidden.has(tab.id));
}

export function pruneHiddenTabs(
  hidden: Set<string>,
  tabs: TerminalTab[]
): Set<string> {
  const ids = new Set(tabs.map((tab) => tab.id));
  const next = new Set<string>();
  for (const id of hidden) {
    if (ids.has(id)) next.add(id);
  }
  return next;
}

export function partitionStripTabs(tabs: TerminalTab[]): {
  shells: TerminalTab[];
  apps: TerminalTab[];
  jobs: TerminalTab[];
} {
  const shells: TerminalTab[] = [];
  const apps: TerminalTab[] = [];
  const jobs: TerminalTab[] = [];
  for (const tab of tabs) {
    if (tab.kind === "shell") shells.push(tab);
    else if (tab.kind === "job") jobs.push(tab);
    else apps.push(tab);
  }
  return { shells, apps, jobs };
}
