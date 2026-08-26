import { dockerExec } from "../sandboxExec.js";
import { parseGithubSlug } from "@forge/core";
import type { Project } from "@forge/db";

const EXCLUDES = [
  "--exclude=./.git",
  "--exclude=*/.git",
  "--exclude=./node_modules",
  "--exclude=*/node_modules"
];

export async function promoteGithubBranch(options: {
  containerName: string;
  workingDir: string;
  project: Project;
  branch: string;
}): Promise<{ target: "github"; branch: string }> {
  if (!parseGithubSlug(options.project.dedupeKey)) {
    throw new Error(`Invalid GitHub slug: ${options.project.dedupeKey}`);
  }
  const r = await dockerExec({
    container: options.containerName,
    argv: [
      "sh",
      "-c",
      'cd "$WD" && git config user.email "forge@local" && git config user.name "Forge Agent" && ' +
        'git add -A && (git commit -q -m "forge: promote working changes" || true) && ' +
        'git push origin "HEAD:$BRANCH"'
    ],
    env: { WD: options.workingDir, BRANCH: options.branch }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || "git push failed");
  }
  return { target: "github", branch: options.branch };
}

export { EXCLUDES };
