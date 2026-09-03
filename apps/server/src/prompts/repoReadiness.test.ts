import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatRepoSetupBlock,
  loadLaunchReadiness,
  loadWorkspaceLaunchReadiness
} from "./repoReadiness.js";

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
      assert.match(block, /preview_start/);
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
      assert.equal(readiness.apps[0]?.name, "web");
      assert.equal(readiness.apps[0]?.type, "web");
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

  it("reads workspace launch.json from session root only", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ws-ready-"));
    await fs.mkdir(path.join(root, ".forge"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".forge", "launch.json"),
      JSON.stringify({
        apps: [
          {
            name: "web",
            repo: "bp-frontend",
            type: "web",
            cwd: "bp-frontend",
            command: "yarn dev",
            port: 3000
          },
          {
            name: "api",
            repo: "bp-backend",
            type: "api",
            cwd: "bp-backend",
            command: "pnpm run start",
            port: 3001
          }
        ]
      })
    );
    try {
      const readiness = loadWorkspaceLaunchReadiness({
        sessionRoot: root,
        memberRepos: ["bp-backend", "bp-frontend"]
      });
      assert.equal(readiness.ready, true);
      assert.equal(readiness.members?.length, 2);
      assert.equal(
        readiness.members?.find((m) => m.repo === "bp-frontend")?.ready,
        true
      );
      assert.equal(
        readiness.members?.find((m) => m.repo === "bp-backend")?.ready,
        true
      );
      const block = formatRepoSetupBlock({
        readiness,
        memberRepos: ["bp-backend", "bp-frontend"]
      });
      assert.match(block, /multiple repositories/);
      assert.match(block, /session root/);
      assert.match(block, /\/workspace\/\.forge\/launch\.json/);
      assert.match(block, /invoke_skill/);
      assert.match(block, /network plane/);
      assert.match(block, /provision_app_engine/);
      assert.doesNotMatch(block, /Never write launch config at the session root/);
      assert.doesNotMatch(block, /Each has its own/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
