import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("invokeSkill.tool", { concurrency: false }, () => {
  let workingDir = "";
  let executeInvokeSkill: (options: {
    sessionId: string;
    skillId: string;
  }) => Promise<{ success: boolean; output: string }>;

  before(async () => {
    mock.module("../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          workingDir,
          containerName: "c",
          sessionRoot: "/workspace",
          repoDir: "repo"
        })
      }
    });
    ({ executeInvokeSkill } = await import("./invokeSkill.tool.js"));
  });

  it("returns user skill body and packaged playwright fallback", async () => {
    workingDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "forge-invoke-skill-")
    );
    const dir = path.join(workingDir, ".forge", "skills", "demo");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      `---
name: Demo
description: Demo skill one-liner.
---
FULL_USER_BODY
`
    );
    try {
      const invoked = await executeInvokeSkill({
        sessionId: "s-invoke",
        skillId: "demo"
      });
      assert.equal(invoked.success, true);
      assert.match(invoked.output, /FULL_USER_BODY/);
      const packaged = await executeInvokeSkill({
        sessionId: "s-invoke",
        skillId: "playwright"
      });
      assert.equal(packaged.success, true);
      assert.match(packaged.output, /npx playwright screenshot/);
      const missing = await executeInvokeSkill({
        sessionId: "s-invoke",
        skillId: "nope"
      });
      assert.equal(missing.success, false);
      assert.match(missing.output, /Unknown skill/);
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  });
});
