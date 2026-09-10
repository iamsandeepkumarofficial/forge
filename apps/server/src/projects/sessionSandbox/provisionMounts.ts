import type { Project, WorkspaceProject } from "@forge/db";
import { WORKSPACE_MOUNT } from "./constants.js";
import { assertLocalFolderPath } from "./materialize.js";
import type { BindMount } from "../sandboxRuntime/types.js";
import {
  canonicalGitContainerPath,
  ensureSessionWorktree
} from "../localWorktree.js";

function localFolderPath(project: Project): string | null {
  if (project.source === "local" && project.canonicalKey) {
    return project.canonicalKey;
  }
  return null;
}

export async function partitionMemberMounts(options: {
  sessionId: string;
  workspaceId: string;
  branchName: string;
  memberProjects: Array<{ member: WorkspaceProject; project: Project }>;
  hostMode: boolean;
}): Promise<{
  bindMounts: BindMount[];
  githubMembers: Array<{ member: WorkspaceProject; project: Project }>;
}> {
  const bindMounts: BindMount[] = [];
  const githubMembers: Array<{
    member: WorkspaceProject;
    project: Project;
  }> = [];
  const { workspaceSessionMemberDir } =
    await import("../../services/project/projectsRoot.js");
  const { ensureWorkspaceMemberCopy } =
    await import("../workspaceMaterialize.js");

  for (const { member, project } of options.memberProjects) {
    const localPath = localFolderPath(project);
    if (localPath) {
      const hostPath = await assertLocalFolderPath(localPath);
      const { memberDir } = await ensureWorkspaceMemberCopy({
        workspaceId: options.workspaceId,
        repoName: member.repoName,
        canonicalKey: hostPath,
        sourceRef: member.sourceRef
      });
      const wt = await ensureSessionWorktree({
        canonicalKey: memberDir,
        projectId: project.id,
        sessionId: options.sessionId,
        branchName: options.branchName,
        workDir: workspaceSessionMemberDir(
          options.workspaceId,
          options.sessionId,
          member.repoName
        ),
        rewriteContainerGitdir: !options.hostMode
      });
      bindMounts.push({
        hostPath: wt.workDir,
        containerPath: `${WORKSPACE_MOUNT}/${member.repoName}`
      });
      if (!options.hostMode) {
        bindMounts.push({
          hostPath: wt.gitCanonicalHostPath,
          containerPath: canonicalGitContainerPath(project.id)
        });
      }
    } else if (project.source === "github") {
      githubMembers.push({ member, project });
    } else {
      throw new Error(
        `Cannot materialize member "${member.repoName}" source "${project.source}"`
      );
    }
  }
  return { bindMounts, githubMembers };
}
