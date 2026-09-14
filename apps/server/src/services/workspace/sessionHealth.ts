import fs from "node:fs";
import path from "node:path";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { ParameterRepository } from "../../catalog/parameterRepository.js";
import { WorkspaceRepository } from "../../catalog/workspaceRepository.js";
import { WorkspaceDatabaseRepository } from "../../catalog/workspaceDatabaseRepository.js";
import { WorkspaceHealthRepository } from "../../catalog/workspaceHealthRepository.js";
import { readForgeConfig } from "../../projects/appRunner/config.js";
import type { AppDbEngineId } from "../../projects/appDb/engines.js";
import { readRepoFactsFromHost } from "../../projects/repoFacts.js";
import { probeAvailableRuntimes } from "../../projects/stacks/registry.js";
import { getSessionRepoInfo } from "../../projects/sessionSandbox.js";
import { workspaceMemberDir } from "../project/projectsRoot.js";
import {
  formatReadinessSummary,
  loadLaunchReadiness,
  readinessFromForgeApps,
  type LaunchReadiness
} from "../../prompts/repoReadiness.js";
import { forgeProvidedKeysForWorkspace } from "../parameters/resolveSessionEnv.js";
import type { WorkspaceHealthReport } from "./health/types.js";
import {
  buildHostToolItems,
  buildInfraItems,
  buildInstallPendingItems,
  buildLiveMissingEnvItems,
  buildRuntimeVersionItems,
  requiredStackHostTools,
  stackFlagsFromMembers,
  worstItemStatus
} from "./sessionHealthChecks.js";
import {
  buildRunningServicesCheck,
  buildWorkspaceAnalysisCheck
} from "./sessionHealthRunning.js";
import type {
  SessionHealthCheck,
  SessionHealthReport
} from "./sessionHealthTypes.js";

export type {
  HealthCheckStatus,
  SessionHealthCheck,
  SessionHealthCheckItem,
  SessionHealthReport
} from "./sessionHealthTypes.js";

export async function getSessionHealthReport(
  sessionId: string
): Promise<SessionHealthReport> {
  const ctx = await loadHealthContext(sessionId);
  const checks: SessionHealthCheck[] = [];
  checks.push(await buildExternalDepsCheck(ctx.externalDeps));
  checks.push({
    id: "launch-config",
    label: "Launch config",
    status: ctx.launchReadiness.ready ? "ok" : "warn",
    summary: formatReadinessSummary(ctx.launchReadiness),
    remediation: ctx.launchReadiness.ready
      ? undefined
      : "invoke_skill workspace-readiness, then upsert_launch_app and preview_start."
  });
  const { runningApps, runningCheck } =
    await buildRunningServicesCheck(sessionId);
  checks.push(runningCheck);
  let workspaceStatus: WorkspaceHealthReport["status"] | undefined;
  if (ctx.savedReport) {
    workspaceStatus = ctx.savedReport.status;
    const analysisCheck = buildWorkspaceAnalysisCheck(ctx.savedReport);
    if (analysisCheck) checks.push(analysisCheck);
  }
  return {
    sessionId,
    workspaceId: ctx.workspaceId,
    computedAt: new Date().toISOString(),
    overall: worstItemStatus(checks.map((c) => c.status)),
    checks,
    launchReadiness: ctx.launchReadiness,
    runningApps,
    ...(workspaceStatus ? { workspaceStatus } : {})
  };
}

async function loadHealthContext(sessionId: string) {
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) {
    throw new Error(`No chat/feature found for session: ${sessionId}`);
  }
  const {
    workingDir,
    worktrees,
    hostWorkingDir,
    hostWorktrees,
    containerName
  } = await getSessionRepoInfo(sessionId);
  const memberRepos = worktrees ? Object.keys(worktrees).sort() : [];
  const isWorkspace = Boolean(chat.workspaceId && memberRepos.length > 0);
  const launchReadiness = await resolveLaunchReadiness({
    sessionId,
    isWorkspace,
    memberRepos,
    hostWorkingDir,
    workingDir
  });
  const savedReport = chat.workspaceId
    ? await loadSavedWorkspaceReport(chat.workspaceId)
    : null;
  const memberRoots = resolveMemberRoots({
    isWorkspace,
    memberRepos,
    hostWorktrees,
    hostWorkingDir,
    workspaceId: chat.workspaceId ?? null
  });
  const memberFacts = memberRoots.map((m) => {
    const facts = readRepoFactsFromHost({
      rootPath: m.rootPath,
      repoName: m.repo,
      analyzable: Boolean(m.rootPath)
    });
    return {
      repo: m.repo,
      rootPath: m.rootPath,
      ecosystemEvidence: facts.ecosystemEvidence,
      hasPackageJson: facts.hasPackageJson,
      detectedStack: facts.detectedStack,
      envKeysReferenced: facts.envKeysReferenced,
      runtimeRequirements: facts.runtimeRequirements
    };
  });
  const availableRuntimes = await probeAvailableRuntimes({
    sessionId,
    containerName
  });
  const availableKeys = await collectAvailableKeys({
    workspaceId: chat.workspaceId ?? null,
    projectId: chat.projectId ?? null
  });
  const attachedEngines = chat.workspaceId
    ? await listAttachedEngines(chat.workspaceId)
    : new Set<AppDbEngineId>();
  const shadows = savedReport?.shadows ?? savedReport?.prepare?.shadows;
  return {
    workspaceId: chat.workspaceId ?? null,
    launchReadiness,
    savedReport,
    externalDeps: {
      memberFacts,
      availableKeys,
      attachedEngines,
      availableRuntimes,
      shadowInfra: shadows?.infraEvidence,
      extraEnvKeys: [
        ...(shadows?.paramCandidates ?? []).map((p) => ({
          key: p.key,
          repo: p.repo
        })),
        ...extractEnvKeysFromFindings(savedReport?.findings ?? [])
      ]
    }
  };
}

async function resolveLaunchReadiness(options: {
  sessionId: string;
  isWorkspace: boolean;
  memberRepos: string[];
  hostWorkingDir?: string;
  workingDir: string;
}): Promise<LaunchReadiness> {
  const { sessionId, isWorkspace, memberRepos, hostWorkingDir, workingDir } =
    options;
  try {
    const { exists, source, config } = await readForgeConfig(sessionId);
    if (isWorkspace) {
      return readinessFromForgeApps({
        apps: config.apps,
        source: exists || config.apps.length > 0 ? source : "none",
        memberRepos
      });
    }
    return {
      ready: config.apps.length > 0,
      source: exists || config.apps.length > 0 ? source : "none",
      apps: config.apps.map((a) => ({
        name: a.name,
        type: a.type,
        cwd: a.cwd,
        command: a.command,
        port: a.port
      }))
    };
  } catch {
    if (hostWorkingDir) {
      return loadLaunchReadiness(hostWorkingDir);
    }
    return loadLaunchReadiness(workingDir);
  }
}

function resolveMemberRoots(options: {
  isWorkspace: boolean;
  memberRepos: string[];
  hostWorktrees?: Record<string, string>;
  hostWorkingDir?: string;
  workspaceId?: string | null;
}): Array<{ repo: string; rootPath: string }> {
  const {
    isWorkspace,
    memberRepos,
    hostWorktrees,
    hostWorkingDir,
    workspaceId
  } = options;
  if (isWorkspace) {
    return memberRepos.map((repo) => {
      if (hostWorktrees?.[repo]) {
        return { repo, rootPath: hostWorktrees[repo]! };
      }
      if (workspaceId) {
        const durable = workspaceMemberDir(workspaceId, repo);
        if (fs.existsSync(durable)) {
          return { repo, rootPath: durable };
        }
      }
      if (hostWorkingDir) {
        return { repo, rootPath: path.join(hostWorkingDir, repo) };
      }
      return { repo, rootPath: "" };
    });
  }
  return [{ repo: "repo", rootPath: hostWorkingDir ?? "" }];
}

async function collectAvailableKeys(options: {
  workspaceId: string | null;
  projectId: string | null;
}): Promise<Set<string>> {
  const paramRepo = new ParameterRepository();
  const keys = new Set<string>(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);
  if (options.workspaceId) {
    const wsParams = await paramRepo.listWorkspaceParameters(
      options.workspaceId
    );
    for (const p of wsParams) {
      if (p.value.trim()) keys.add(p.key);
    }
    for (const k of await forgeProvidedKeysForWorkspace(options.workspaceId)) {
      keys.add(k);
    }
    const workspaceRepo = new WorkspaceRepository();
    const members = await workspaceRepo.listMembers(options.workspaceId);
    for (const m of members) {
      for (const [k, v] of Object.entries(m.env ?? {})) {
        if (String(v).trim()) keys.add(k);
      }
      const projectParams = await paramRepo.listProjectParameters(m.projectId);
      for (const p of projectParams) {
        if (p.value.trim()) keys.add(p.key);
      }
    }
  }
  if (options.projectId) {
    const projectParams = await paramRepo.listProjectParameters(
      options.projectId
    );
    for (const p of projectParams) {
      if (p.value.trim()) keys.add(p.key);
    }
  }
  return keys;
}

async function listAttachedEngines(
  workspaceId: string
): Promise<Set<AppDbEngineId>> {
  const repo = new WorkspaceDatabaseRepository();
  const rows = await repo.list(workspaceId);
  return new Set(rows.map((r) => r.engineId as AppDbEngineId));
}

function extractEnvKeysFromFindings(
  findings: Array<{ code: string; message: string; repo?: string }>
): Array<{ key: string; repo?: string }> {
  const out: Array<{ key: string; repo?: string }> = [];
  for (const f of findings) {
    if (f.code !== "missing-env-key") continue;
    const m = f.message.match(/`([^`]+)`/);
    if (m?.[1]) out.push({ key: m[1], repo: f.repo });
  }
  return out;
}

async function buildExternalDepsCheck(options: {
  memberFacts: Array<{
    repo: string;
    rootPath: string;
    ecosystemEvidence: import("../../projects/repoFacts.js").EcosystemEvidence[];
    hasPackageJson: boolean;
    detectedStack: string[];
    envKeysReferenced: string[];
    runtimeRequirements: import("../../projects/stacks/types.js").RuntimeRequirement[];
  }>;
  availableKeys: ReadonlySet<string>;
  attachedEngines: ReadonlySet<AppDbEngineId>;
  availableRuntimes: import("../../projects/stacks/registry.js").AvailableRuntimes;
  shadowInfra?: AppDbEngineId[];
  extraEnvKeys?: Array<{ key: string; repo?: string }>;
}): Promise<SessionHealthCheck> {
  const flags = stackFlagsFromMembers(options.memberFacts);
  const required = requiredStackHostTools(flags);
  const hostItems = await buildHostToolItems(
    required,
    options.availableRuntimes
  );
  const versionItems = buildRuntimeVersionItems({
    members: options.memberFacts,
    available: options.availableRuntimes
  });
  const installItems = buildInstallPendingItems({
    members: options.memberFacts
  });
  const infraItems = buildInfraItems({
    members: options.memberFacts,
    attachedEngines: options.attachedEngines,
    shadowInfra: options.shadowInfra
  });
  const envItems = buildLiveMissingEnvItems({
    members: options.memberFacts,
    availableKeys: options.availableKeys,
    extraKeys: options.extraEnvKeys
  });
  const items = [
    ...hostItems,
    ...versionItems,
    ...installItems,
    ...infraItems,
    ...envItems
  ];
  const status = worstItemStatus(
    items.length > 0 ? items.map((i) => i.status) : ["ok"]
  );
  const failing = items.filter((i) => i.status !== "ok");
  return {
    id: "external-deps",
    label: "External dependencies",
    status,
    summary:
      failing.length === 0
        ? "Host tools, versions, installs, infra, and env look ready."
        : `${failing.length} gap(s): host tools, versions, installs, infra, and/or env.`,
    detail: failing
      .map((i) => `${i.label}: ${i.summary ?? i.status}`)
      .join("\n"),
    remediation:
      status === "ok"
        ? undefined
        : "invoke_skill workspace-readiness → stack skill for installs/versions. Infra: ask_user → setup_project_infra. Env: ask_user → upsert_workspace_parameter.",
    items
  };
}

async function loadSavedWorkspaceReport(
  workspaceId: string
): Promise<WorkspaceHealthReport | null> {
  const healthRepo = new WorkspaceHealthRepository();
  const row = await healthRepo.get(workspaceId);
  if (!row?.report || typeof row.report !== "object") return null;
  return row.report as WorkspaceHealthReport;
}
