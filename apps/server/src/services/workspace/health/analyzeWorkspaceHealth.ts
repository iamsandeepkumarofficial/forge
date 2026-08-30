import { ProjectRepository } from "../../../catalog/projectRepository.js";
import { WorkspaceRepository } from "../../../catalog/workspaceRepository.js";
import { ParameterRepository } from "../../../catalog/parameterRepository.js";
import {
  detectEnginesFromFacts,
  type AppDbEngineId
} from "../../../projects/appDb/engines.js";
import {
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  isLikelySecretKey,
  readRepoFactsFromHost
} from "../../../projects/repoFacts.js";
import { selectSandboxImageName } from "../../../projects/sessionSandbox/constants.js";
import { findDependsOnCycle } from "../workspaceWiring.js";
import {
  deriveHealthStatus,
  memberHealthFromFacts,
  type HealthFinding,
  type ParamShadowCandidate,
  type WorkspaceHealthReport,
  type WorkspacePrepareShadows
} from "./types.js";
import { forgeProvidedKeysForWorkspace } from "../../parameters/resolveSessionEnv.js";
import { envKeySatisfied } from "../../parameters/envKeyAliases.js";

const RUNTIME_KEYS = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);

function factsRootForProject(project: {
  source: string;
  canonicalKey: string | null;
}): { path: string; analyzable: boolean } {
  if (project.source === "local" && project.canonicalKey) {
    return { path: project.canonicalKey, analyzable: true };
  }
  return { path: "", analyzable: false };
}

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
            ? raw.slice(0, 40)
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
    if (!project) {
      findings.push({
        code: "missing-project",
        severity: "error",
        repo: member.repoName,
        message: "Member project record is missing."
      });
      continue;
    }

    const { path: rootPath, analyzable } = factsRootForProject(project);
    const facts = readRepoFactsFromHost({
      rootPath: analyzable ? rootPath : "",
      repoName: member.repoName,
      analyzable
    });
    memberHealthList.push(memberHealthFromFacts(member.repoName, facts));
    factsByMember.push({ repo: member.repoName, facts });

    if (!facts.analyzable) {
      findings.push({
        code: "needs-clone",
        severity: "warning",
        repo: member.repoName,
        message:
          project.source === "github"
            ? "GitHub member is not on disk until the first session clones it."
            : "Member repo is not readable on the host.",
        hint: "Start a workspace chat to clone and analyze fully."
      });
      continue;
    }

    const hasNode = factsHaveNodeEvidence(facts);
    if (hasNode && !facts.hasPackageJson) {
      findings.push({
        code: "missing-package-json",
        severity: "info",
        repo: member.repoName,
        message: "Node ecosystem evidence without a root package.json.",
        hint: "Verify the project root or monorepo package paths."
      });
    } else if (
      hasNode &&
      !facts.scripts.includes("dev") &&
      !facts.scripts.includes("start")
    ) {
      findings.push({
        code: "missing-dev-script",
        severity: "warning",
        repo: member.repoName,
        message: "package.json has no dev or start script.",
        hint: "Add a dev/start script or configure launch via the setup agent / upsert_launch_app."
      });
    }

    if (!facts.launchReady) {
      findings.push({
        code: "session-launch-pending",
        severity: "info",
        repo: member.repoName,
        message:
          "Workspace apps are declared in session-root `/workspace/.forge/launch.json` when a chat starts (not per-member).",
        hint: "Open Workspace setup chat; agent scaffolds launch.json after invoke_skill."
      });
    }

    for (const app of facts.launchApps) {
      if (app.port != null) {
        const other = usedPorts.get(app.port);
        if (other && other !== member.repoName) {
          findings.push({
            code: "port-collision",
            severity: "error",
            repo: member.repoName,
            message: `Port ${app.port} also used by \`${other}\`.`,
            hint: "Assign unique ports in 3000–3009 per app."
          });
        } else {
          usedPorts.set(app.port, member.repoName);
        }
      }
    }

    if (factsHavePythonEvidence(facts)) {
      findings.push({
        code: "toolchain-needed",
        severity: "info",
        repo: member.repoName,
        message:
          "Python stack evidence — invoke `python-app` skill; propose runtime install if python3 is missing.",
        hint: "Do not treat this as a Node-only ceiling. After user approval, install toolchain via run_terminal."
      });
    }

    const projectParams = await paramRepo.listProjectParameters(member.projectId);
    const availableKeys = new Set([
      ...filledWorkspaceKeys,
      ...projectParams.filter((p) => p.value.trim()).map((p) => p.key),
      ...Object.entries(member.env ?? {})
        .filter(([, v]) => String(v).trim())
        .map(([k]) => k),
      ...provided
    ]);
    for (const key of facts.envKeysFromSource) {
      if (provided.has(key)) continue;
      if (RUNTIME_KEYS.has(key)) continue;
      if (envKeySatisfied(availableKeys, key)) continue;
      findings.push({
        code: "missing-env-key",
        severity: "warning",
        repo: member.repoName,
        message: `Referenced env key \`${key}\` is not in project/workspace parameters or member env.`,
        hint:
          key === "DATABASE_URL" ||
          key === "MONGODB_URI" ||
          key === "MONGODB_URL"
            ? `Propose ${
                key.startsWith("MONGO") ? "MongoDB" : "PostgreSQL"
              } via provision_app_engine (user-approved), or ask_user then upsert_workspace_parameter.`
            : `Use ask_user then upsert_workspace_parameter for \`${key}\`.`
      });
    }

    for (const dep of member.dependsOn ?? []) {
      if (!memberNames.has(dep)) {
        findings.push({
          code: "invalid-depends-on",
          severity: "error",
          repo: member.repoName,
          message: `dependsOn references unknown member \`${dep}\`.`,
          hint: "Update dependsOn to list valid member repoNames."
        });
      }
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

  const status = deriveHealthStatus(findings);
  return {
    status,
    computedAt: new Date().toISOString(),
    members: memberHealthList,
    findings,
    dependsOnGraph,
    shadows
  };
}
