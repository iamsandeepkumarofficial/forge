import type { ForgeApp } from "./appRunner.js";

const PREFIX = "[launchConfig]";

export type LaunchConfigSource =
  | "existing"
  | "seeded"
  | "scaffolded"
  | "none";

export function formatLaunchAppNames(apps: ForgeApp[]): string {
  if (apps.length === 0) return "(none)";
  return apps.map((a) => a.name).join(", ");
}

function logLine(message: string): void {
  console.info(`${PREFIX} ${message}`);
}

export function logLaunchConfigExisting(options: {
  sessionId: string;
  workspaceId?: string | null;
  appCount: number;
  appNames: string;
}): void {
  const ws = options.workspaceId
    ? ` workspace=${options.workspaceId}`
    : "";
  logLine(
    `reuse session=${options.sessionId}${ws} apps=${options.appCount} names=${options.appNames} (launch.json already in sandbox)`
  );
}

export function logLaunchConfigSeedSkip(options: {
  sessionId: string;
  workspaceId?: string | null;
  reason: "not-workspace-chat" | "catalog-missing" | "catalog-empty" | "catalog-invalid";
}): void {
  const ws = options.workspaceId
    ? ` workspace=${options.workspaceId}`
    : "";
  logLine(
    `seed skip session=${options.sessionId}${ws} reason=${options.reason}`
  );
}

export function logLaunchConfigSeeded(options: {
  sessionId: string;
  workspaceId: string;
  appCount: number;
  appNames: string;
  sourceSessionId: string | null;
  catalogUpdatedAt: string | null;
}): void {
  logLine(
    `seed session=${options.sessionId} workspace=${options.workspaceId} apps=${options.appCount} names=${options.appNames} catalogSourceSession=${options.sourceSessionId ?? "none"} catalogUpdatedAt=${options.catalogUpdatedAt ?? "unknown"} (copied workspace catalog → sandbox)`
  );
}

export function logLaunchConfigScaffolded(options: {
  sessionId: string;
  workspaceId?: string | null;
  appCount: number;
  appNames: string;
}): void {
  const ws = options.workspaceId
    ? ` workspace=${options.workspaceId}`
    : "";
  logLine(
    `scaffold session=${options.sessionId}${ws} apps=${options.appCount} names=${options.appNames} (detectApps → new launch.json in sandbox)`
  );
}

export function logLaunchConfigNone(options: {
  sessionId: string;
  workspaceId?: string | null;
}): void {
  const ws = options.workspaceId
    ? ` workspace=${options.workspaceId}`
    : "";
  logLine(
    `none session=${options.sessionId}${ws} (no catalog seed and detectApps found nothing)`
  );
}

export function logLaunchConfigPromoted(options: {
  sessionId: string;
  workspaceId: string;
  appCount: number;
  appNames: string;
}): void {
  logLine(
    `promote session=${options.sessionId} workspace=${options.workspaceId} apps=${options.appCount} names=${options.appNames} (sandbox launch.json → workspace catalog)`
  );
}

export function logLaunchConfigProvisionResult(options: {
  sessionId: string;
  source: LaunchConfigSource;
  ready: boolean;
  appNames?: string;
}): void {
  logLine(
    `provision session=${options.sessionId} source=${options.source} ready=${options.ready}${options.appNames ? ` names=${options.appNames}` : ""}`
  );
}
