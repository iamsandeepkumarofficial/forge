import fs from "node:fs";
import path from "node:path";
import {
  formatSkillsPromptBlock,
  loadSkillIndexForPrompt
} from "../tools/skillIndex.js";
import { formatRepoSetupBlock, loadLaunchReadiness, loadWorkspaceLaunchReadiness } from "./repoReadiness.js";

const N_65536 = 65536;
const N_2000000 = 2000000;

export type ChatAgentPromptPaths = {
  sessionRoot: string;
  repoDir: string;
  workingDir: string;
  sessionId?: string;
  /** Multi-repo workspace sessions: repoName -> absolute mount path. */
  worktrees?: Record<string, string>;
};

const BASE_INSTRUCTIONS = [
  "You are Forge, a coding and project-management agent for this session's repository.",
  "",
  "## How to work",
  "- Use the tools you were given. Explore before editing; match existing style.",
  "- Tool output is private — do not dump raw files or search hits unless asked.",
  "- After substantive edits, verify with the tools available in this mode.",
  "- Be concise. Ask only when a decision is blocking.",
  "- Skills: the index below is id + description only. Call invoke_skill to load full instructions. Call list_skills only to refresh the index (e.g. skills changed)."
] as const;

function agentsMdMaxBytes(): number {
  const raw = process.env.FORGE_RULES_MAX_BYTES?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return Math.min(Math.floor(n), N_2000000);
    }
  }
  return N_65536;
}

function readTextFileLimited(options: {
  filePath: string;
  maxBytes: number;
}): string {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(options.filePath);
  } catch {
    return "";
  }
  if (buf.length > options.maxBytes) {
    buf = buf.subarray(0, options.maxBytes);
  }
  return buf.toString("utf8").trim();
}

function loadAgentsMd(workingDir: string): string {
  const cap = agentsMdMaxBytes();
  const primary = readTextFileLimited({
    filePath: path.join(workingDir, "AGENTS.md"),
    maxBytes: cap
  });
  if (primary) {
    return primary;
  }
  return readTextFileLimited({
    filePath: path.join(workingDir, "Agents.md"),
    maxBytes: cap
  });
}

function sandboxFilesystemBlock(paths: ChatAgentPromptPaths): string {
  const root = paths.workingDir || paths.sessionRoot;
  const worktrees = paths.worktrees;
  const names = worktrees ? Object.keys(worktrees).sort() : [];
  if (names.length > 0) {
    const lines = names.map((n) => `- \`${n}/\` → \`${worktrees![n]}\` (git root)`);
    return [
      "## Working repositories (authoritative)",
      `- Session root: \`${root}\`. This is a **workspace** with ${names.length} mounted repo${names.length === 1 ? "" : "s"}:`,
      ...lines,
      `- All source lives under these member folders. There is **no** project at \`${root}\` itself — do not create \`${root}/.forge/launch.json\` or treat \`${root}\` as a git repo.`,
      `- File tools (\`read_file\`, \`write_file\`, \`edit_file\`, \`list_files\`, \`search_codebase\`): paths are relative to \`${root}\` and **must start with a member repo name** (example: \`${names[0]}/package.json\`). Never use host paths (\`/Users/…\`, \`/home/…\`).`,
      `- \`run_terminal\` default cwd is \`${root}\`. Always pass \`workingDirectory\` as a member repo (e.g. \`${names[0]}\`) or a subdirectory under it.`,
      `- Each member has its own git root and its own \`.forge/launch.json\` (path: \`${names[0]}/.forge/launch.json\`).`,
      "- Coordinated cross-repo edits are fine; keep changes scoped to the repos that need them."
    ].join("\n");
  }
  return [
    "## Working repository (authoritative)",
    `- Workspace and git root: \`${root}\`. The repository is mounted here directly — there is no extra repo folder.`,
    `- File tools (\`read_file\`, \`write_file\`, \`edit_file\`, \`list_files\`, \`search_codebase\`): paths are relative to \`${root}\` (example: \`package.json\`, \`src/app.ts\`). Never use host paths (\`/Users/…\`, \`/home/…\`), never prefix with a repo folder name, never use absolute paths outside this sandbox.`,
    `- \`run_terminal\` default cwd is \`${root}\`. Pass \`workingDirectory\` only for a subdirectory (e.g. \`apps/web\`). Long installs/tests: \`background: true\`, then poll \`action: "logs"\`. Dev servers: preview_start.`,
    `- \`.forge/launch.json\`, \`AGENTS.md\`, \`.forge/skills/\`, and project source live under \`${root}\`.`,
    "- There is exactly one connected repository in this session. Do not look for sibling repos or alternate roots."
  ].join("\n");
}

export function composeChatAgentSystemPrompt(
  paths: ChatAgentPromptPaths
): string {
  const worktrees = paths.worktrees;
  const memberNames = worktrees ? Object.keys(worktrees).sort() : [];
  const isWorkspace = memberNames.length > 0;

  const agentsMd = isWorkspace
    ? memberNames
        .map((name) => {
          const body = loadAgentsMd(worktrees![name]!);
          return body ? `### ${name}\n${body}` : "";
        })
        .filter(Boolean)
        .join("\n\n")
    : loadAgentsMd(paths.workingDir);

  const skillsRoot = isWorkspace
    ? (worktrees![memberNames[0]!] ?? paths.workingDir)
    : paths.workingDir;
  const skills = loadSkillIndexForPrompt({
    sessionId: paths.sessionId,
    workingDir: skillsRoot
  });

  const readiness = isWorkspace
    ? loadWorkspaceLaunchReadiness(worktrees!)
    : loadLaunchReadiness(paths.workingDir);

  const parts = [
    ...BASE_INSTRUCTIONS,
    "",
    sandboxFilesystemBlock(paths),
    "",
    formatRepoSetupBlock({
      readiness,
      memberRepos: isWorkspace ? memberNames : undefined
    })
  ];
  if (agentsMd) {
    parts.push("", "## Repository instructions", agentsMd);
  }
  const skillsBlock = formatSkillsPromptBlock(skills);
  if (skillsBlock) {
    parts.push("", skillsBlock);
  }
  return parts.join("\n");
}
