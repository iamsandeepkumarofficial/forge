import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { composeChatAgentSystemPrompt } from "./chatAgent.prompts.js";
import { invalidateSkillIndex } from "../tools/skillIndex.js";

describe("composeChatAgentSystemPrompt", () => {
  it("includes identity, sandbox paths, and platform ops for single-repo", () => {
    const prompt = composeChatAgentSystemPrompt({
      sessionRoot: "/workspace",
      repoDir: "repo",
      workingDir: "/workspace",
      executionTarget: "local"
    });
    assert.match(
      prompt,
      /You are Forge, a coding and project-management agent/
    );
    assert.match(prompt, /Working repository \(authoritative\)/);
    assert.match(prompt, /Workspace and git root: `\/workspace`/);
    assert.doesNotMatch(prompt, /Repository folder name/);
    assert.doesNotMatch(prompt, /repo\/package\.json/);
    assert.match(prompt, /## Starting apps/);
    assert.match(prompt, /preview_start/);
    assert.match(prompt, /40000–49999/);
    assert.doesNotMatch(prompt, /Eval: not agent-ready/);
    assert.doesNotMatch(prompt, /## Workspace health/);
    assert.doesNotMatch(prompt, /Workspace setup SOP/);
    assert.doesNotMatch(prompt, /Hard citation rule/);
    assert.doesNotMatch(prompt, /create_subtask/);
  });

  it("lists workspace members only under Workspace repos when inventory provided", () => {
    const prompt = composeChatAgentSystemPrompt({
      sessionRoot: "/workspace",
      repoDir: "bp-frontend",
      workingDir: "/workspace",
      executionTarget: "local",
      worktrees: {
        "bp-frontend": "/workspace/bp-frontend",
        "bp-backend": "/workspace/bp-backend"
      },
      inventoryBlock: [
        "## Workspace repos",
        "Per-member inventory for this workspace session:",
        "- `bp-backend/` → `/workspace/bp-backend`",
        "- `bp-frontend/` → `/workspace/bp-frontend`",
        "- File tools: paths must start with a member repo name"
      ].join("\n")
    });
    assert.doesNotMatch(prompt, /Working repositories \(authoritative\)/);
    assert.match(prompt, /## Workspace repos/);
    assert.match(prompt, /`bp-frontend\/` → `\/workspace\/bp-frontend`/);
    assert.match(prompt, /`bp-backend\/` → `\/workspace\/bp-backend`/);
    assert.match(prompt, /must start with a member repo name/);
    assert.match(prompt, /## Starting apps/);
    assert.match(prompt, /get_workspace_health/);
    assert.match(prompt, /invoke_skill/);
    assert.doesNotMatch(prompt, /Workspace setup SOP/);
    assert.doesNotMatch(prompt, /## Workspace health/);
    assert.doesNotMatch(prompt, /There is exactly one connected repository/);
  });

  it("omits AGENTS.md section when absent and ignores specs/", async () => {
    const sessionRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "forge-prompt-")
    );
    const repo = path.join(sessionRoot, "repo");
    await fs.mkdir(path.join(repo, "specs"), { recursive: true });
    await fs.writeFile(
      path.join(repo, "specs", "overview.md"),
      "# Spec\nDo the thing.\n"
    );
    try {
      const prompt = composeChatAgentSystemPrompt({
        sessionRoot,
        repoDir: "repo",
        workingDir: repo
      });
      assert.doesNotMatch(prompt, /## Repository instructions/);
      assert.doesNotMatch(prompt, /Do the thing/);
    } finally {
      await fs.rm(sessionRoot, { recursive: true, force: true });
    }
  });

  it("injects AGENTS.md and skills index without full SKILL.md body", async () => {
    const sessionRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "forge-prompt-")
    );
    const repo = path.join(sessionRoot, "repo");
    const skillsDir = path.join(repo, ".forge", "skills", "demo");
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(repo, "AGENTS.md"),
      "# Repo agents\nUse pnpm.\n"
    );
    await fs.writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---
name: Demo
description: Demo skill one-liner.
---

# Full body that must not appear in the index
SECRET_BODY_TOKEN
`
    );
    const sessionId = `sess-${Date.now()}`;
    invalidateSkillIndex(sessionId);
    try {
      const prompt = composeChatAgentSystemPrompt({
        sessionRoot,
        repoDir: "repo",
        workingDir: repo,
        sessionId
      });
      assert.match(prompt, /## Repository instructions/);
      assert.match(prompt, /Use pnpm/);
      assert.match(prompt, /## Available skills/);
      assert.match(prompt, /`demo` — Demo skill one-liner/);
      assert.doesNotMatch(prompt, /SECRET_BODY_TOKEN/);
    } finally {
      invalidateSkillIndex(sessionId);
      await fs.rm(sessionRoot, { recursive: true, force: true });
    }
  });
});
