import type {
  EcosystemEvidence,
  RepoFacts
} from "../../../projects/repoFacts.js";
import type { AppDbEngineId } from "../../../projects/appDb/engines.js";

export type HealthSeverity = "error" | "warning" | "info";

export type HealthFinding = {
  code: string;
  severity: HealthSeverity;
  repo?: string;
  message: string;
  hint?: string;
};

export type MemberHealth = {
  repo: string;
  analyzable: boolean;
  packageManager?: string;
  hasPackageJson: boolean;
  scripts: string[];
  launchApps: Array<{
    name: string;
    type?: string;
    port?: number;
    command?: string;
  }>;
  detectedStack: string[];
  suggestedSkills: string[];
  envKeysReferenced: string[];
  ecosystemEvidence: EcosystemEvidence[];
};

export type ParamShadowCandidate = {
  key: string;
  secretLikely: boolean;
  
  exampleHint?: string;
  repo?: string;
};

export type WorkspacePrepareShadows = {
  ecosystemEvidence: Array<{
    repo: string;
    evidence: EcosystemEvidence[];
  }>;
  paramCandidates: ParamShadowCandidate[];
  infraEvidence: AppDbEngineId[];
  preferredSandboxImage: string;
};

export type WorkspacePrepareReport = {
  
  parametersSeeded: string[];
  databases: Record<string, string>;
  installs: Array<{
    repo: string;
    cached: boolean;
    command?: string;
    error?: string;
  }>;
  errors: string[];
  shadows?: WorkspacePrepareShadows;
};

export type WorkspaceHealthReport = {
  status: "ready" | "blocked" | "warnings" | "computing";
  computedAt: string;
  members: MemberHealth[];
  findings: HealthFinding[];
  dependsOnGraph: Array<{ repo: string; dependsOn: string[] }>;
  prepare?: WorkspacePrepareReport;
  
  shadows?: WorkspacePrepareShadows;
};

export function memberHealthFromFacts(
  repo: string,
  facts: RepoFacts
): MemberHealth {
  return {
    repo,
    analyzable: facts.analyzable,
    packageManager: facts.packageManager,
    hasPackageJson: facts.hasPackageJson,
    scripts: facts.scripts,
    launchApps: facts.launchApps,
    detectedStack: facts.detectedStack,
    suggestedSkills: facts.suggestedSkills,
    envKeysReferenced: facts.envKeysReferenced,
    ecosystemEvidence: facts.ecosystemEvidence
  };
}

export function deriveHealthStatus(
  findings: HealthFinding[]
): "ready" | "blocked" | "warnings" {
  if (findings.some((f) => f.severity === "error")) return "blocked";
  if (findings.some((f) => f.severity === "warning")) return "warnings";
  return "ready";
}

export function formatHealthPromptBlock(report: WorkspaceHealthReport): string {
  const blockers = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const lines = ["## Workspace health"];
  if (blockers.length === 0 && warnings.length === 0) {
    lines.push("Eval: ready — no blockers detected at last analysis.");
  } else {
    if (blockers.length > 0) {
      lines.push("Blockers:");
      for (const f of blockers.slice(0, 8)) {
        lines.push(
          `- [${f.code}]${f.repo ? ` \`${f.repo}\`` : ""}: ${f.message}${f.hint ? ` — ${f.hint}` : ""}`
        );
      }
    }
    if (warnings.length > 0) {
      lines.push("Warnings:");
      for (const f of warnings.slice(0, 8)) {
        lines.push(
          `- [${f.code}]${f.repo ? ` \`${f.repo}\`` : ""}: ${f.message}${f.hint ? ` — ${f.hint}` : ""}`
        );
      }
    }
  }
  const shadows = report.shadows ?? report.prepare?.shadows;
  if (shadows) {
    lines.push("", "## Setup shadows (evidence only — do not treat as applied)");
    lines.push(
      `Preferred sandbox image (from evidence): \`${shadows.preferredSandboxImage}\``
    );
    for (const row of shadows.ecosystemEvidence) {
      if (row.evidence.length === 0) continue;
      const bits = row.evidence.map(
        (e) =>
          `${e.ecosystem}[${e.manifests.join(", ")}]${e.packageManagerGuess ? ` pm~${e.packageManagerGuess}` : ""}`
      );
      lines.push(`- \`${row.repo}\`: ${bits.join("; ")}`);
    }
    if (shadows.paramCandidates.length > 0) {
      lines.push(
        `- Param candidates (upsert via tool after confirming): ${shadows.paramCandidates
          .slice(0, 16)
          .map((p) => `\`${p.key}\`${p.secretLikely ? "*" : ""}`)
          .join(", ")}${shadows.paramCandidates.length > 16 ? ", …" : ""}`
      );
    }
    if (shadows.infraEvidence.length > 0) {
      lines.push(
        `- Infra evidence (propose then provision_app_engine with userApproved): ${shadows.infraEvidence.join(", ")}`
      );
    }
  }
  return lines.join("\n");
}

export function formatSetupAgentSopBlock(options?: {
  preferredSandboxImage?: string;
}): string {
  const image = options?.preferredSandboxImage
    ? `\`${options.preferredSandboxImage}\``
    : "the session sandbox image";
  return [
    "## Workspace setup SOP",
    "Platform is stack-agnostic. Skills own stack-specific install/launch.",
    `1. Read shadow ecosystemEvidence + which sandbox image is running (preferred: ${image}).`,
    "2. Identify stack per member (compare to shadows for eval).",
    "3. If image mismatches stack (e.g. generic but need Node/Playwright), propose switching images to the user.",
    "4. `invoke_skill` for that stack (`nodejs-app`, `python-app`, …).",
    "5. Follow the skill: toolchain if needed (`ask_user` → user OK) → install via `run_terminal`.",
    "6. Params/secrets/infra: call `ask_user` (mcq or form widget) — never ask only in prose. Form fields must set `value` to a sensible default (example URL, generated secret, etc.). After the user answers, `upsert_workspace_parameter` and/or `provision_app_engine` with `userApproved: true`. The widget is honor-system consent, not a cryptographic gate.",
    "7. Launch / migrations / preview per skills. Never invent a platform install matrix."
  ].join("\n");
}
