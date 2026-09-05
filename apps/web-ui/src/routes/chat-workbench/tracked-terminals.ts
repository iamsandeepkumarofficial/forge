import {
  releaseTerminalSessionClient,
  retainTerminalSessionClient
} from "../../lib/terminal-session-registry.js";
import {
  streamIdForAppTab,
  streamIdForJobTab
} from "../../lib/terminal-session-client.js";
import type { ToolPart } from "../../lib/tool-display.js";
import { toolPartName } from "../../lib/tool-display.js";

export type TrackedKind = "app" | "job";

type TrackedEntry = {
  sessionId: string;
  kind: TrackedKind;
  name: string;
  unsubscribe: () => void;
};

const tracked = new Map<string, TrackedEntry>();

const exitedKeys = new Set<string>();
const listeners = new Set<() => void>();

function entryKey(options: {
  sessionId: string;
  kind: TrackedKind;
  name: string;
}): string {
  return `${options.sessionId}\0${options.kind}\0${options.name}`;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeTrackedTerminals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listTrackedNames(
  sessionId: string,
  kind: TrackedKind
): string[] {
  const id = sessionId.trim();
  const names: string[] = [];
  for (const entry of tracked.values()) {
    if (entry.sessionId === id && entry.kind === kind) names.push(entry.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export function isTracked(options: {
  sessionId: string;
  kind: TrackedKind;
  name: string;
}): boolean {
  return tracked.has(
    entryKey({
      sessionId: options.sessionId.trim(),
      kind: options.kind,
      name: options.name.trim()
    })
  );
}

function untrack(key: string): void {
  const entry = tracked.get(key);
  if (!entry) return;
  entry.unsubscribe();
  tracked.delete(key);
  releaseTerminalSessionClient(entry.sessionId);
  emit();
}

function markExited(key: string): void {
  exitedKeys.add(key);
  untrack(key);
}

function track(options: {
  sessionId: string;
  kind: TrackedKind;
  rawName: string;
  streamId: string;
  restart?: boolean;
}): void {
  const id = options.sessionId.trim();
  const name = options.rawName.trim();
  if (!id || !name) return;
  const key = entryKey({ sessionId: id, kind: options.kind, name });
  if (options.restart) {
    exitedKeys.delete(key);
  }
  if (exitedKeys.has(key) || tracked.has(key)) return;

  const client = retainTerminalSessionClient(id);
  const unsubscribe = client.subscribe(options.streamId, {
    onExited: () => markExited(key),
    onError: () => untrack(key)
  });
  tracked.set(key, {
    sessionId: id,
    kind: options.kind,
    name,
    unsubscribe
  });
  emit();
}

export function trackApp(sessionId: string, appName: string): void {
  const name = appName.trim();
  track({
    sessionId,
    kind: "app",
    rawName: name,
    streamId: streamIdForAppTab(`app:${name}`),
    restart: true
  });
}

export function trackBackgroundJob(sessionId: string, jobName: string): void {
  const name = jobName.trim();
  track({
    sessionId,
    kind: "job",
    rawName: name,
    streamId: streamIdForJobTab(name),
    restart: true
  });
}

export function untrackApp(sessionId: string, appName: string): void {
  const key = entryKey({
    sessionId: sessionId.trim(),
    kind: "app",
    name: appName.trim()
  });
  exitedKeys.add(key);
  untrack(key);
}

export function untrackBackgroundJob(sessionId: string, jobName: string): void {
  const key = entryKey({
    sessionId: sessionId.trim(),
    kind: "job",
    name: jobName.trim()
  });
  exitedKeys.add(key);
  untrack(key);
}

export function listTrackedApps(sessionId: string): string[] {
  return listTrackedNames(sessionId, "app");
}

export function listTrackedBackgroundJobs(sessionId: string): string[] {
  return listTrackedNames(sessionId, "job");
}

export function isAppTracked(sessionId: string, appName: string): boolean {
  return isTracked({ sessionId, kind: "app", name: appName });
}

export function isBackgroundJobTracked(
  sessionId: string,
  jobName: string
): boolean {
  return isTracked({ sessionId, kind: "job", name: jobName });
}

export const subscribeBackgroundJobs = subscribeTrackedTerminals;

export function resetTrackedTerminalsForTests(): void {
  listeners.clear();
  exitedKeys.clear();
  for (const key of [...tracked.keys()]) {
    untrack(key);
  }
}

export const resetBackgroundJobsForTests = resetTrackedTerminalsForTests;

function toolInput(part: ToolPart): Record<string, unknown> | null {
  const input = part.input ?? part.args;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return null;
}

export function terminalActionFromToolPart(part: ToolPart): string {
  const input = toolInput(part);
  const action = input?.action;
  if (typeof action === "string" && action.trim()) return action.trim();
  return "run";
}

export function terminalJobNameFromToolPart(part: ToolPart): string | null {
  const meta = part.metadata;
  if (meta && typeof meta.jobName === "string" && meta.jobName.trim()) {
    return meta.jobName.trim();
  }
  const input = toolInput(part);
  if (typeof input?.jobName === "string" && input.jobName.trim()) {
    return input.jobName.trim();
  }
  return null;
}

export function terminalAppNameFromToolPart(part: ToolPart): string | null {
  const meta = part.metadata;
  if (meta && typeof meta === "object") {
    const app = (meta as { app?: unknown }).app;
    if (app && typeof app === "object" && !Array.isArray(app)) {
      const name = (app as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
    if (typeof meta.appName === "string" && meta.appName.trim()) {
      return meta.appName.trim();
    }
  }
  const input = toolInput(part);
  if (typeof input?.name === "string" && input.name.trim()) {
    return input.name.trim();
  }
  return null;
}

export function isBackgroundTerminalToolPart(part: ToolPart): boolean {
  if (toolPartName(part) !== "run_terminal") return false;
  if (terminalActionFromToolPart(part) !== "run") return false;
  const input = toolInput(part);
  if (input?.background === true) return true;
  const meta = part.metadata;
  return meta?.running === true;
}

export function shouldTrackBackgroundToolPart(part: ToolPart): boolean {
  if (!isBackgroundTerminalToolPart(part)) return false;
  const name = terminalJobNameFromToolPart(part);
  if (!name) return false;
  const meta = part.metadata;
  if (meta && meta.running === false) return false;
  const input = toolInput(part);
  if (input?.background === true) return true;
  return meta?.running === true;
}

export function shouldUntrackBackgroundToolPart(part: ToolPart): boolean {
  if (toolPartName(part) !== "run_terminal") return false;
  const name = terminalJobNameFromToolPart(part);
  if (!name) return false;
  const action = terminalActionFromToolPart(part);
  if (action === "stop")
    return part.output !== undefined || part.result !== undefined;
  if (action !== "run") return false;
  const meta = part.metadata;
  return meta?.running === false;
}

export function shouldTrackPreviewStartToolPart(part: ToolPart): boolean {
  if (toolPartName(part) !== "preview_start") return false;
  const name = terminalAppNameFromToolPart(part);
  if (!name || part.errorText) return false;
  const meta = part.metadata;
  const app = meta?.app;
  if (app && typeof app === "object" && !Array.isArray(app)) {
    const running = (app as { running?: unknown }).running;
    if (running === false) return false;
  }
  return true;
}

export function shouldUntrackPreviewStopToolPart(part: ToolPart): boolean {
  if (toolPartName(part) !== "preview_stop") return false;
  const name = terminalAppNameFromToolPart(part);
  if (!name) return false;
  return part.output !== undefined || part.result !== undefined;
}

export function trackTerminalsFromToolParts(
  sessionId: string,
  parts: ToolPart[]
): void {
  for (const part of parts) {
    if (shouldUntrackBackgroundToolPart(part)) {
      const name = terminalJobNameFromToolPart(part);
      if (name) untrackBackgroundJob(sessionId, name);
    }
    if (shouldUntrackPreviewStopToolPart(part)) {
      const name = terminalAppNameFromToolPart(part);
      if (name) untrackApp(sessionId, name);
    }
    if (shouldTrackBackgroundToolPart(part)) {
      const name = terminalJobNameFromToolPart(part);
      if (!name) continue;
      const input = toolInput(part);
      track({
        sessionId,
        kind: "job",
        rawName: name,
        streamId: streamIdForJobTab(name),
        restart: input?.background === true
      });
    }
    if (shouldTrackPreviewStartToolPart(part)) {
      const name = terminalAppNameFromToolPart(part);
      if (name) {
        track({
          sessionId,
          kind: "app",
          rawName: name,
          streamId: streamIdForAppTab(`app:${name}`)
        });
      }
    }
  }
}

export const trackBackgroundJobsFromToolParts = trackTerminalsFromToolParts;
