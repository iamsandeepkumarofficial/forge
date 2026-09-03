import type { FileTab } from "./types.js";

export const PREVIEW_TAB_ID = "preview";

export function fileTabId(path: string): string {
  return `file:${path}`;
}

export function diffTabId(repo: string, path: string): string {
  return `diff:${repo}:${path}`;
}

export function tabLabel(tab: FileTab): string {
  return tab.path.split("/").filter(Boolean).pop() ?? tab.path;
}

export function upsertDocTab(docs: FileTab[], tab: FileTab): FileTab[] {
  return docs.some((d) => d.id === tab.id) ? docs : [...docs, tab];
}

export function closeDocTab(docs: FileTab[], id: string): FileTab[] {
  return docs.filter((d) => d.id !== id);
}

export function nextActiveAfterClose(
  activeId: string,
  closedId: string,
  remaining: FileTab[]
): string {
  if (activeId !== closedId) return activeId;
  return remaining.at(-1)?.id ?? PREVIEW_TAB_ID;
}
