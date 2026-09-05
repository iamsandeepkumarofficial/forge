import type { Project, WorkspaceProject } from "@forge/db";
import { ParameterRepository } from "../../../catalog/parameterRepository.js";
import {
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  readRepoFactsFromHost
} from "../../../projects/repoFacts.js";
import { envKeySatisfied } from "../../parameters/envKeyAliases.js";
import {
  memberHealthFromFacts,
  type HealthFinding,
  type MemberHealth
} from "./types.js";

const RUNTIME_KEYS = new Set(["HOST", "PORT", "FORGE_PUBLISHED_APP_PORTS"]);

export function factsRootForProject(project: {
  source: string;
  canonicalKey: string | null;
}): { path: string; analyzable: boolean } {
  if (project.source === "local" && project.canonicalKey) {
    return { path: project.canonicalKey, analyzable: true };
  }
  return { path: "", analyzable: false };
}

export async function collectMemberFindings(options: {
  member: WorkspaceProject;
  project: Project | null;
  paramRepo: ParameterRepository;
  filledWorkspaceKeys: Set<string>;
  provided: Set<string>;
  memberNames: Set<string>;
  usedPorts: Map<number, string>;
}): Promise<{
  findings: HealthFinding[];
  memberHealth: MemberHealth | null;
  facts: ReturnType<typeof readRepoFactsFromHost> | null;
}> {
  const {
    member,
    project,
    paramRepo,
    filledWorkspaceKeys,
    provided,
    memberNames,
    usedPorts
  } = options;
  const seeded = seedMemberFacts({ member, project });
  if (seeded.kind === "early") {
    return {
      findings: seeded.findings,
      memberHealth: seeded.memberHealth,
      facts: seeded.facts
    };
  }
  const { findings, memberHealth, facts } = seeded;

  pushScriptFindings({ findings, member, facts });
  pushPortFindings({ findings, member, facts, usedPorts });
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
  await pushEnvFindings({
    findings,
    member,
    facts,
    paramRepo,
    filledWorkspaceKeys,
    provided
  });
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

  return { findings, memberHealth, facts };
}

function seedMemberFacts(options: {
  member: WorkspaceProject;
  project: Project | null;
}):
  | {
      kind: "early";
      findings: HealthFinding[];
      memberHealth: MemberHealth | null;
      facts: ReturnType<typeof readRepoFactsFromHost> | null;
    }
  | {
      kind: "ready";
      findings: HealthFinding[];
      memberHealth: MemberHealth;
      facts: ReturnType<typeof readRepoFactsFromHost>;
    } {
  const { member, project } = options;
  if (!project) {
    return {
      kind: "early",
      findings: [
        {
          code: "missing-project",
          severity: "error",
          repo: member.repoName,
          message: "Member project record is missing."
        }
      ],
      memberHealth: null,
      facts: null
    };
  }
  const { path: rootPath, analyzable } = factsRootForProject(project);
  const facts = readRepoFactsFromHost({
    rootPath: analyzable ? rootPath : "",
    repoName: member.repoName,
    analyzable
  });
  const memberHealth = memberHealthFromFacts(member.repoName, facts);
  if (!facts.analyzable) {
    return {
      kind: "early",
      findings: [
        {
          code: "needs-clone",
          severity: "warning",
          repo: member.repoName,
          message:
            project.source === "github"
              ? "GitHub member is not on disk until the first session clones it."
              : "Member repo is not readable on the host.",
          hint: "Start a workspace chat to clone and analyze fully."
        }
      ],
      memberHealth,
      facts
    };
  }
  return { kind: "ready", findings: [], memberHealth, facts };
}

function pushScriptFindings(options: {
  findings: HealthFinding[];
  member: WorkspaceProject;
  facts: ReturnType<typeof readRepoFactsFromHost>;
}): void {
  const { findings, member, facts } = options;
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
  const hasNode = factsHaveNodeEvidence(facts);
  if (hasNode && !facts.hasPackageJson) {
    findings.push({
      code: "missing-package-json",
      severity: "info",
      repo: member.repoName,
      message: "Node ecosystem evidence without a root package.json.",
      hint: "Verify the project root or monorepo package paths."
    });
    return;
  }
  if (
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
}

function pushPortFindings(options: {
  findings: HealthFinding[];
  member: WorkspaceProject;
  facts: ReturnType<typeof readRepoFactsFromHost>;
  usedPorts: Map<number, string>;
}): void {
  const { findings, member, facts, usedPorts } = options;
  for (const app of facts.launchApps) {
    if (app.port == null) continue;
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

async function pushEnvFindings(options: {
  findings: HealthFinding[];
  member: WorkspaceProject;
  facts: ReturnType<typeof readRepoFactsFromHost>;
  paramRepo: ParameterRepository;
  filledWorkspaceKeys: Set<string>;
  provided: Set<string>;
}): Promise<void> {
  const { findings, member, facts, paramRepo, filledWorkspaceKeys, provided } =
    options;
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
        key === "DATABASE_URL" || key === "MONGODB_URI" || key === "MONGODB_URL"
          ? `Propose ${
              key.startsWith("MONGO") ? "MongoDB" : "PostgreSQL"
            } via provision_app_engine (user-approved), or ask_user then upsert_workspace_parameter.`
          : `Use ask_user then upsert_workspace_parameter for \`${key}\`.`
    });
  }
}
