import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensurePackagedSkillsInSession,
  formatSkillsPromptBlock,
  invalidateSkillIndex,
  loadSkillIndexForPrompt,
  mergeSkillIndexes,
  readSkillBodyFromHost
} from "./skillIndex.js";

describe("skillIndex", () => {
  it("merges user skills over packaged ids", () => {
    const merged = mergeSkillIndexes(
      [{ skillId: "playwright", skillName: "Packaged", description: "P" }],
      [{ skillId: "playwright", skillName: "User", description: "U" }]
    );
    assert.deepEqual(merged, [
      { skillId: "playwright", skillName: "User", description: "U" }
    ]);
  });

  it("formats prompt block without bodies", () => {
    const block = formatSkillsPromptBlock([
      { skillId: "demo", skillName: "Demo", description: "One liner." }
    ]);
    assert.match(block, /## Available skills/);
    assert.match(block, /`demo` — One liner/);
    assert.equal(formatSkillsPromptBlock([]), "");
  });

  it("copies packaged skills into session .forge/skills when missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-skill-seed-"));
    try {
      const copied = ensurePackagedSkillsInSession(root);
      assert.ok(copied.includes("playwright"));
      const dest = path.join(
        root,
        ".forge",
        "skills",
        "playwright",
        "SKILL.md"
      );
      const body = await fs.readFile(dest, "utf8");
      assert.match(body, /npx playwright screenshot/);
      assert.deepEqual(ensurePackagedSkillsInSession(root), []);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("loads user skills from .forge/skills and caches per session", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-skill-index-"));
    const dir = path.join(root, ".forge", "skills", "demo");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      `---
name: Demo
description: Demo skill one-liner.
---
SECRET_BODY_TOKEN
`
    );
    const sessionId = `idx-${Date.now()}`;
    invalidateSkillIndex(sessionId);
    try {
      const first = loadSkillIndexForPrompt({ sessionId, workingDir: root });
      assert.ok(first.some((e) => e.skillId === "demo"));
      assert.ok(first.some((e) => e.skillId === "playwright"));
      const body = readSkillBodyFromHost({ workingDir: root, skillId: "demo" });
      assert.match(body ?? "", /SECRET_BODY_TOKEN/);
      await fs.writeFile(
        path.join(dir, "SKILL.md"),
        `---
name: Demo
description: Changed after cache.
---
`
      );
      const cached = loadSkillIndexForPrompt({ sessionId, workingDir: root });
      assert.equal(
        cached.find((e) => e.skillId === "demo")?.description,
        "Demo skill one-liner."
      );
      invalidateSkillIndex(sessionId);
      const refreshed = loadSkillIndexForPrompt({
        sessionId,
        workingDir: root
      });
      assert.equal(
        refreshed.find((e) => e.skillId === "demo")?.description,
        "Changed after cache."
      );
    } finally {
      invalidateSkillIndex(sessionId);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
