import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { composeChatAgentSystemPrompt } from "./chatAgent.prompts.js";
import { invalidateSkillIndex } from "../tools/skillIndex.js";

describe("composeChatAgentSystemPrompt", () => {
  it("includes identity, sandbox paths, and launch.json setup", () => {
    const prompt = composeChatAgentSystemPrompt({
      sessionRoot: "/workspace",
      repoDir: "repo",
      workingDir: "/workspace"
    });
    assert.match(
      prompt,
      /You are Forge, a coding and project-management agent/
    );
    assert.match(prompt, /Workspace and git root: `\/workspace`/);
    assert.doesNotMatch(prompt, /Repository folder name/);
    assert.doesNotMatch(prompt, /repo\/package\.json/);
    assert.match(prompt, /\.forge\/launch\.json/);
    assert.match(prompt, /Eval: not agent-ready/);
    assert.match(prompt, /preview_start \/ preview_stop/);
    assert.match(prompt, /3000–3009/);
    assert.doesNotMatch(prompt, /Hard citation rule/);
    assert.doesNotMatch(prompt, /create_subtask/);
    assert.doesNotMatch(prompt, /Playwright skill or run Playwright/);
    assert.doesNotMatch(prompt, /FORGE_GLOBAL_RULES/);
    assert.doesNotMatch(prompt, /Repository specifications/);
    assert.doesNotMatch(prompt, /_\(No /);
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
