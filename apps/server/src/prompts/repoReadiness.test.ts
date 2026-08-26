import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { formatRepoSetupBlock, loadLaunchReadiness } from "./repoReadiness.js";

describe("repoReadiness", () => {
  it("reports missing launch.json as not agent-ready", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ready-"));
    try {
      const readiness = loadLaunchReadiness(root);
      assert.deepEqual(readiness, {
        ready: false,
        source: "none",
        apps: []
      });
      const block = formatRepoSetupBlock({ readiness });
      assert.match(block, /Eval: not agent-ready/);
      assert.match(block, /upsert_launch_app/);
      assert.match(block, /preview_start \/ preview_stop/);
      assert.match(block, /3000–3009/);
      assert.match(block, /FORGE_PUBLISHED_APP_PORTS/);
      assert.doesNotMatch(block, /forge\.json/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("lists apps from .forge/launch.json", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ready-"));
    await fs.mkdir(path.join(root, ".forge"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".forge", "launch.json"),
      JSON.stringify({
        apps: [{ name: "web", type: "web", cwd: ".", command: "pnpm dev" }]
      })
    );
    try {
      const readiness = loadLaunchReadiness(root);
      assert.equal(readiness.ready, true);
      assert.equal(readiness.source, "launch");
      assert.deepEqual(readiness.apps, [{ name: "web", type: "web" }]);
      const block = formatRepoSetupBlock({ readiness });
      assert.match(block, /Eval: agent-ready/);
      assert.match(block, /`web` \(web\)/);
      assert.doesNotMatch(block, /forge\.json/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to legacy forge.json", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ready-"));
    await fs.writeFile(
      path.join(root, "forge.json"),
      JSON.stringify({
        apps: [
          {
            name: "api",
            type: "api",
            cwd: "apps/api",
            command: "npm run dev"
          }
        ]
      })
    );
    try {
      const readiness = loadLaunchReadiness(root);
      assert.equal(readiness.ready, true);
      assert.equal(readiness.source, "legacy");
      const block = formatRepoSetupBlock({ readiness });
      assert.match(block, /Eval: agent-ready/);
      assert.doesNotMatch(block, /forge\.json/);
      assert.doesNotMatch(block, /legacy/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
