import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveSandbox } from "./sandboxExec.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../catalog/projectRepository.js";
import { EXCLUDES, promoteGithubBranch, promoteLocalBranch } from "./codeArchive/promote.js";

export async function spawnRepoTarGz(sessionId: string): Promise<{
  child: ChildProcessWithoutNullStreams;
  filename: string;
}> {
  const { containerName, workingDir, repoDir } =
    await resolveSandbox(sessionId);
  const child = spawn(
    "docker",
    [
      "exec",
      containerName,
      "sh",
      "-c",
      `cd "${workingDir}" && tar czf - ${EXCLUDES.join(" ")} .`
    ],
    { env: process.env }
  );
  return { child, filename: `${repoDir}.tar.gz` };
}

export async function promoteToCanonical(sessionId: string): Promise<{
  target: "github" | "local";
  branch?: string;
  files?: number;
}> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat = await chatRepo.getBySessionId(sessionId);
  if (!chat) throw new Error(`No chat/feature found for session: ${sessionId}`);
  if (!chat.projectId) {
    throw new Error(
      "promoteToCanonical is not yet supported for workspace-scoped sessions"
    );
  }
  const project = await projectRepo.getById(chat.projectId);
  if (!project)
    throw new Error(`Project not found for chat session: ${sessionId}`);
  const { containerName, workingDir } = await resolveSandbox(sessionId);
  if (project.source === "github") {
    return promoteGithubBranch({
      containerName,
      workingDir,
      project,
      branch: chat.branchName
    });
  }
  return promoteLocalBranch({
    containerName,
    workingDir,
    project,
    branch: chat.branchName
  });
}
