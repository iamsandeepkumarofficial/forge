import { dockerExec } from "./sandboxExec.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ProjectRepository } from "../catalog/projectRepository.js";
import { WorkspaceRepository } from "../catalog/workspaceRepository.js";
import { mergeSessionBranchIntoCanonical } from "./localWorktree.js";
import { WORKSPACE_MOUNT } from "./sessionSandbox/constants.js";

/**
 * Commit `.forge/launch.json` in the session worktree (in-container) and merge
 * the session branch into the local project's canonical repo (RFC 0005 history).
 */
export async function commitAndMergeLaunchJson(options: {
  sessionId: string;
  containerName: string;
  /** Empty = project-scoped session writing at /workspace. */
  repos: string[];
}): Promise<void> {
  const chatRepo = new ChatFeatureRepository();
  const projectRepo = new ProjectRepository();
  const chat = await chatRepo.getBySessionId(options.sessionId);
  if (!chat) return;

  const targets: Array<{ mountPath: string; canonicalKey: string }> = [];

  if (chat.workspaceId) {
    const workspaceRepo = new WorkspaceRepository();
    const members = await workspaceRepo.listMembers(chat.workspaceId);
    const wanted = new Set(options.repos);
    for (const member of members) {
      if (wanted.size > 0 && !wanted.has(member.repoName)) continue;
      const project = await projectRepo.getById(member.projectId);
      if (!project || project.source !== "local" || !project.canonicalKey) {
        continue;
      }
      targets.push({
        mountPath: `${WORKSPACE_MOUNT}/${member.repoName}`,
        canonicalKey: project.canonicalKey
      });
    }
  } else if (chat.projectId) {
    const project = await projectRepo.getById(chat.projectId);
    if (project?.source === "local" && project.canonicalKey) {
      targets.push({
        mountPath: WORKSPACE_MOUNT,
        canonicalKey: project.canonicalKey
      });
    }
  }

  for (const target of targets) {
    const r = await dockerExec({
      container: options.containerName,
      argv: [
        "sh",
        "-c",
        'cd "$WD" && git config user.email "forge@local" && git config user.name "Forge Agent" && ' +
          "git add -- .forge/launch.json && " +
          '(git diff --cached --quiet || git commit -q -m "forge: update .forge/launch.json")'
      ],
      env: { WD: target.mountPath }
    });
    if (r.code !== 0) {
      console.warn(
        `[commitAndMergeLaunchJson] commit failed in ${target.mountPath}: ${r.stderr.trim() || r.stdout.trim()}`
      );
      continue;
    }
    try {
      await mergeSessionBranchIntoCanonical({
        canonicalKey: target.canonicalKey,
        branchName: chat.branchName
      });
    } catch (err) {
      console.warn(
        `[commitAndMergeLaunchJson] merge into ${target.canonicalKey} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
