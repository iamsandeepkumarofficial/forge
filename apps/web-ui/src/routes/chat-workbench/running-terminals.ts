export type RunningTerminalItem = {
  id: string;
  kind: "app" | "job";
  label: string;
};

export function runningTerminalItemsFrom(options: {
  appTabs: Array<{ id: string; kind: string; label: string; running: boolean }>;
  jobs: Array<{ name: string; running: boolean }>;
}): RunningTerminalItem[] {
  const items: RunningTerminalItem[] = [];
  for (const tab of options.appTabs) {
    if (tab.kind !== "app" || !tab.running) continue;
    items.push({ id: tab.id, kind: "app", label: tab.label });
  }
  for (const job of options.jobs) {
    if (!job.running) continue;
    const name = job.name.trim();
    if (!name) continue;
    items.push({ id: `job:${name}`, kind: "job", label: name });
  }
  return items;
}
