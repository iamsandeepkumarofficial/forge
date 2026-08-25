import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("listSkills.tool", { concurrency: false }, () => {
  let workingDir = "";
  let executeListSkills: (sessionId: string) => Promise<{
    success: boolean;
    output: string;
  }>;

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
    ({ executeListSkills } = await import("./listSkills.tool.js"));
  });

  it("refreshes index and seeds packaged skills into the session", async () => {
    workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-list-skills-"));
    try {
      const listed = await executeListSkills("s-list");
      assert.equal(listed.success, true);
      assert.match(listed.output, /playwright/);
      const seeded = path.join(
        workingDir,
        ".forge",
        "skills",
        "playwright",
        "SKILL.md"
      );
      const body = await fs.readFile(seeded, "utf8");
      assert.match(body, /npx playwright screenshot/);
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  });
});
