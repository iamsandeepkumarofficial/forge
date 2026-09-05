import { ProjectRepository } from "../../../catalog/projectRepository.js";
import { WorkspaceRepository } from "../../../catalog/workspaceRepository.js";
import { ParameterRepository } from "../../../catalog/parameterRepository.js";
import {
  detectEnginesFromFacts,
  type AppDbEngineId
} from "../../../projects/appDb/engines.js";
import {
  factsHaveNodeEvidence,
  isLikelySecretKey,
  readRepoFactsFromHost
} from "../../../projects/repoFacts.js";
import { selectSandboxImageName } from "../../../projects/sessionSandbox/constants.js";
import { findDependsOnCycle } from "../workspaceWiring.js";
import {
  deriveHealthStatus,
  type HealthFinding,
  type ParamShadowCandidate,
  type WorkspaceHealthReport,
  type WorkspacePrepareShadows
} from "./types.js";
import { forgeProvidedKeysForWorkspace } from "../../parameters/resolveSessionEnv.js";
import { collectMemberFindings } from "./collectMemberFindings.js";

const RUNTIME_KEYS = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);
const N_40 = 40;

export function buildPrepareShadows(options: {
  members: Array<{
    repo: string;
    facts: ReturnType<typeof readRepoFactsFromHost>;
  }>;
  filledKeys: Set<string>;
}): WorkspacePrepareShadows {
  const paramCandidates: ParamShadowCandidate[] = [];
  const seenKeys = new Set<string>();
  const infra = new Set<AppDbEngineId>();
  let hasNode = false;

  for (const { repo, facts } of options.members) {
    if (!facts.analyzable) continue;
    if (factsHaveNodeEvidence(facts)) hasNode = true;
    for (const id of detectEnginesFromFacts(facts)) infra.add(id);
    for (const key of facts.envKeysReferenced) {
      if (RUNTIME_KEYS.has(key)) continue;
      if (options.filledKeys.has(key)) continue;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const secretLikely = isLikelySecretKey(key);
      const raw = facts.envExampleValues[key];
      paramCandidates.push({
        key,
        secretLikely,
        repo,
        exampleHint:
          raw && !secretLikely
            ? raw.slice(0, N_40)
            : secretLikely
              ? "(secret)"
              : undefined
      });
    }
  }

  return {
    ecosystemEvidence: options.members.map(({ repo, facts }) => ({
      repo,
      evidence: facts.ecosystemEvidence
    })),
    paramCandidates,
    infraEvidence: [...infra],
    preferredSandboxImage: selectSandboxImageName({ hasNodeEvidence: hasNode })
  };
}

export async function analyzeWorkspaceHealth(
  workspaceId: string
): Promise<WorkspaceHealthReport> {
  const workspaceRepo = new WorkspaceRepository();
  const projectRepo = new ProjectRepository();
  const paramRepo = new ParameterRepository();
  const members = await workspaceRepo.listMembers(workspaceId);
  const workspaceParams = await paramRepo.listWorkspaceParameters(workspaceId);
  const filledWorkspaceKeys = new Set(
    workspaceParams.filter((p) => p.value.trim()).map((p) => p.key)
  );
  const provided = await forgeProvidedKeysForWorkspace(workspaceId);
  for (const k of RUNTIME_KEYS) provided.add(k);

  const dependsOnGraph = members.map((m) => ({
    repo: m.repoName,
    dependsOn: m.dependsOn ?? []
  }));

  const findings: HealthFinding[] = [];
  const memberHealthList = [];
  const memberNames = new Set(members.map((m) => m.repoName));
  const usedPorts = new Map<number, string>();
  const factsByMember: Array<{
    repo: string;
    facts: ReturnType<typeof readRepoFactsFromHost>;
  }> = [];

  const cycle = findDependsOnCycle(
    members.map((m) => ({ repoName: m.repoName, dependsOn: m.dependsOn ?? [] }))
  );
  if (cycle) {
    findings.push({
      code: "depends-on-cycle",
      severity: "error",
      message: `dependsOn cycle: ${cycle.join(" -> ")}`,
      hint: "Remove circular dependencies between workspace members."
    });
  }

  for (const member of members) {
    const project = await projectRepo.getById(member.projectId);
    const collected = await collectMemberFindings({
      member,
      project,
      paramRepo,
      filledWorkspaceKeys,
      provided,
      memberNames,
      usedPorts
    });
    findings.push(...collected.findings);
    if (collected.memberHealth) memberHealthList.push(collected.memberHealth);
    if (collected.facts) {
      factsByMember.push({ repo: member.repoName, facts: collected.facts });
    }
  }

  if (members.length === 0) {
    findings.push({
      code: "no-members",
      severity: "error",
      message: "Workspace has no member projects.",
      hint: "Add at least one project in workspace settings."
    });
  }

  const shadows = buildPrepareShadows({
    members: factsByMember,
    filledKeys: new Set([...filledWorkspaceKeys, ...provided])
  });

  return {
    status: deriveHealthStatus(findings),
    computedAt: new Date().toISOString(),
    members: memberHealthList,
    findings,
    dependsOnGraph,
    shadows
  };
}
