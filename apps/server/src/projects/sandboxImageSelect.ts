import { ProjectRepository } from "../catalog/projectRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import {
  factsHaveNodeEvidence,
  readRepoFactsFromHost
} from "./repoFacts.js";
import { selectSandboxImageName } from "./sessionSandbox/constants.js";

function factsRootForProject(project: {
  source: string;
  canonicalKey: string | null;
}): { path: string; analyzable: boolean } {
  if (project.source === "local" && project.canonicalKey) {
    return { path: project.canonicalKey, analyzable: true };
  }
  return { path: "", analyzable: false };
}

/** Any member with Node ecosystem evidence → Node image; else generic. */
export async function selectSandboxImageForWorkspace(
  workspaceId: string
): Promise<string> {
  const workspaceRepo = new WorkspaceRepository();
  const projectRepo = new ProjectRepository();
  const members = await workspaceRepo.listMembers(workspaceId);
  let hasNode = false;
  for (const member of members) {
    const project = await projectRepo.getById(member.projectId);
    if (!project) continue;
    const { path: rootPath, analyzable } = factsRootForProject(project);
    if (!analyzable) continue;
    const facts = readRepoFactsFromHost({
      rootPath,
      repoName: member.repoName
    });
    if (factsHaveNodeEvidence(facts)) {
      hasNode = true;
      break;
    }
  }
  return selectSandboxImageName({ hasNodeEvidence: hasNode });
}
