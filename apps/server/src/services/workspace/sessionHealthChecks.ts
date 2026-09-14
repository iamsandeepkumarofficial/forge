import fs from "node:fs";
import {
  detectEnginesFromFacts,
  getAppDbEngine,
  type AppDbEngineId
} from "../../projects/appDb/engines.js";
import { commandOnPath } from "../../projects/sandboxRuntime/osSandbox.js";
import type { EcosystemEvidence } from "../../projects/repoFacts.js";
import {
  getStackAdapter,
  installGapForEvidence,
  requiredHostTools,
  STACK_ADAPTERS,
  type AvailableRuntimes,
  type RuntimeRequirement,
  type StackFactsView
} from "../../projects/stacks/registry.js";
import { versionSatisfiesRange } from "../../projects/versionSatisfy.js";
import { envKeySatisfied } from "../parameters/envKeyAliases.js";
import type { HealthFinding, WorkspaceHealthReport } from "./health/types.js";

export type HealthCheckStatus = "ok" | "warn" | "fail" | "unknown";

export type SessionHealthCheckItem = {
  id: string;
  status: HealthCheckStatus;
  label: string;
  summary?: string;
};

const RUNTIME_KEYS = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);

const EXTERNAL_DEPS_FINDING_CODES = new Set([
  "missing-env-key",
  "toolchain-needed"
]);

const FORGE_RUNTIME_HINT =
  "ask_user → install_project_infra (dependencyId=node, version=<major>) into ~/.forge/runtime — session PATH prefers forge runtime";

export function worstItemStatus(
  statuses: HealthCheckStatus[]
): HealthCheckStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  if (statuses.includes("unknown")) return "unknown";
  return "ok";
}

export function requiredStackHostTools(options: {
  hasNode: boolean;
  hasPython: boolean;
  hasGo: boolean;
}): string[] {
  const views: StackFactsView[] = [];
  if (options.hasNode) {
    views.push({
      ecosystemEvidence: [{ ecosystem: "node" }],
      hasPackageJson: true
    });
  }
  if (options.hasPython) {
    views.push({
      ecosystemEvidence: [{ ecosystem: "python" }]
    });
  }
  if (options.hasGo) {
    views.push({
      ecosystemEvidence: [{ ecosystem: "go" }]
    });
  }
  return requiredHostTools(views);
}

export async function buildHostToolItems(
  required: string[],
  available?: AvailableRuntimes
): Promise<SessionHealthCheckItem[]> {
  const items: SessionHealthCheckItem[] = [];
  for (const tool of required) {
    const ok = await commandOnPath(tool);
    const adapter = STACK_ADAPTERS.find((a) => a.hostBinary === tool);
    const ver = adapter ? available?.[adapter.id] : undefined;
    items.push({
      id: `host-tool:${tool}`,
      status: ok ? "ok" : "fail",
      label: tool,
      summary: ok ? (ver ? `on PATH (${ver})` : "on PATH") : "missing from PATH"
    });
  }
  return items;
}

export function installMarkerMissing(
  rootPath: string,
  evidence: EcosystemEvidence[]
): string | null {
  if (!fs.existsSync(rootPath)) return null;
  return installGapForEvidence(rootPath, evidence);
}

export function buildInstallPendingItems(options: {
  members: Array<{
    repo: string;
    rootPath: string;
    ecosystemEvidence: EcosystemEvidence[];
    hasPackageJson: boolean;
  }>;
}): SessionHealthCheckItem[] {
  const items: SessionHealthCheckItem[] = [];
  for (const m of options.members) {
    const evidence =
      m.ecosystemEvidence.length > 0
        ? m.ecosystemEvidence
        : m.hasPackageJson
          ? [
              {
                ecosystem: "node" as const,
                manifests: ["package.json"],
                lockfiles: []
              }
            ]
          : [];
    if (evidence.length === 0) continue;
    const gap = installMarkerMissing(m.rootPath, evidence);
    items.push({
      id: `install:${m.repo}`,
      status: gap ? "warn" : "ok",
      label: m.repo,
      summary: gap ?? "install markers present"
    });
  }
  return items;
}

function skillHint(adapterId: string): string {
  const adapter = getStackAdapter(adapterId as "node" | "python" | "go");
  return adapter?.skillId ?? "workspace-readiness";
}

export function buildRuntimeVersionItems(options: {
  members: Array<{
    repo: string;
    runtimeRequirements: RuntimeRequirement[];
    ecosystemEvidence?: EcosystemEvidence[];
    hasPackageJson?: boolean;
  }>;
  available: AvailableRuntimes;
}): SessionHealthCheckItem[] {
  const items: SessionHealthCheckItem[] = [];
  const covered = new Set<string>();

  for (const m of options.members) {
    for (const req of m.runtimeRequirements) {
      covered.add(`${m.repo}:${req.tool}`);
      const adapter = getStackAdapter(req.tool);
      const label = `${adapter?.label ?? req.tool} (${m.repo})`;
      const skill = skillHint(req.tool);
      const have = options.available[req.tool];
      if (!have) {
        items.push({
          id: `runtime-version:${req.tool}:${m.repo}`,
          status: "fail",
          label,
          summary: `needs ${req.range} (from ${req.source}); not installed in session runtime — invoke_skill ${skill} then ${FORGE_RUNTIME_HINT}`
        });
        continue;
      }
      const ok = versionSatisfiesRange(have, req.range);
      items.push({
        id: `runtime-version:${req.tool}:${m.repo}`,
        status: ok ? "ok" : "fail",
        label,
        summary: ok
          ? `${have} satisfies ${req.range} (${req.source})`
          : `needs ${req.range} (from ${req.source}); have ${have} — invoke_skill ${skill} / ${FORGE_RUNTIME_HINT}`
      });
    }

    const view: StackFactsView = {
      ecosystemEvidence: m.ecosystemEvidence ?? [],
      hasPackageJson: m.hasPackageJson
    };
    for (const adapter of STACK_ADAPTERS) {
      if (covered.has(`${m.repo}:${adapter.id}`)) continue;
      if (!adapter.matchesFacts(view)) continue;
      const have = options.available[adapter.id];
      items.push({
        id: `runtime-version:${adapter.id}:${m.repo}`,
        status: have ? "ok" : "warn",
        label: `${adapter.label} (${m.repo})`,
        summary: have
          ? `session has ${have} (no pin declared; could not infer a range)`
          : `${adapter.label} not detected in session runtime`
      });
    }
  }
  return items;
}

export function buildInfraItems(options: {
  members: Array<{
    repo: string;
    envKeysReferenced: string[];
    detectedStack: string[];
  }>;

  attachedEngines: ReadonlySet<AppDbEngineId>;

  shadowInfra?: AppDbEngineId[];
}): SessionHealthCheckItem[] {
  const needed = new Set<AppDbEngineId>();
  for (const m of options.members) {
    for (const id of detectEnginesFromFacts({
      envKeysReferenced: m.envKeysReferenced,
      detectedStack: m.detectedStack
    })) {
      needed.add(id);
    }
  }
  for (const id of options.shadowInfra ?? []) needed.add(id);
  const items: SessionHealthCheckItem[] = [];
  for (const id of [...needed].sort()) {
    const engine = getAppDbEngine(id);
    const attached = options.attachedEngines.has(id);
    items.push({
      id: `infra:${id}`,
      status: attached ? "ok" : "warn",
      label: engine?.label ?? id,
      summary: attached
        ? `attached (${engine?.envKey ?? id})`
        : `needed — ask_user then setup_project_infra (${id})`
    });
  }
  return items;
}

export function buildLiveMissingEnvItems(options: {
  members: Array<{
    repo: string;
    envKeysReferenced: string[];
  }>;
  availableKeys: ReadonlySet<string>;

  extraKeys?: Array<{ key: string; repo?: string }>;
}): SessionHealthCheckItem[] {
  const seen = new Set<string>();
  const items: SessionHealthCheckItem[] = [];
  const pushKey = (key: string, repo?: string) => {
    if (RUNTIME_KEYS.has(key)) return;
    if (envKeySatisfied(options.availableKeys, key)) return;
    const dedupe = `${repo ?? ""}:${key}`;
    if (seen.has(dedupe) || seen.has(`:${key}`)) return;
    seen.add(dedupe);
    items.push({
      id: `env:${repo ?? "workspace"}:${key}`,
      status: "warn",
      label: repo ? `${repo}` : "workspace",
      summary: `\`${key}\` not set — ask_user → upsert_workspace_parameter${
        key === "DATABASE_URL" || key === "MONGODB_URI" || key === "MONGODB_URL"
          ? " (or setup_project_infra)"
          : ""
      }`
    });
  };
  for (const m of options.members) {
    for (const key of m.envKeysReferenced) pushKey(key, m.repo);
  }
  for (const row of options.extraKeys ?? []) pushKey(row.key, row.repo);
  return items;
}

export function buildMissingEnvItems(
  findings: HealthFinding[]
): SessionHealthCheckItem[] {
  return findings
    .filter((f) => f.code === "missing-env-key")
    .map((f) => ({
      id: `env:${f.repo ?? "workspace"}:${f.message}`,
      status: (f.severity === "error" ? "fail" : "warn") as HealthCheckStatus,
      label: f.repo ? `${f.repo}` : "workspace",
      summary: f.message
    }));
}

export function analysisFindingsForChecklist(
  report: WorkspaceHealthReport
): HealthFinding[] {
  return (report.findings ?? []).filter(
    (f) =>
      (f.severity === "error" || f.severity === "warning") &&
      !EXTERNAL_DEPS_FINDING_CODES.has(f.code)
  );
}

export function buildAnalysisItems(
  findings: HealthFinding[]
): SessionHealthCheckItem[] {
  return findings.map((f) => ({
    id: `analysis:${f.code}:${f.repo ?? "ws"}:${f.message}`,
    status: (f.severity === "error" ? "fail" : "warn") as HealthCheckStatus,
    label: f.repo ? `${f.code} (${f.repo})` : f.code,
    summary: f.message
  }));
}

export function stackFlagsFromMembers(
  members: Array<{
    ecosystemEvidence: EcosystemEvidence[];
    detectedStack?: string[];
    hasPackageJson?: boolean;
  }>
): { hasNode: boolean; hasPython: boolean; hasGo: boolean } {
  let hasNode = false;
  let hasPython = false;
  let hasGo = false;
  for (const m of members) {
    const view: StackFactsView = {
      ecosystemEvidence: m.ecosystemEvidence,
      detectedStack: m.detectedStack,
      hasPackageJson: m.hasPackageJson
    };
    for (const adapter of STACK_ADAPTERS) {
      if (!adapter.matchesFacts(view)) continue;
      if (adapter.id === "node") hasNode = true;
      if (adapter.id === "python") hasPython = true;
      if (adapter.id === "go") hasGo = true;
    }
  }
  return { hasNode, hasPython, hasGo };
}
