import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatPlatformOpsBlock,
  formatReadinessSummary,
  loadLaunchReadiness,
  loadWorkspaceLaunchReadiness
} from "./repoReadiness.js";

describe("repoReadiness", () => {
  it("reports missing launch.json as not ready via summary", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ready-"));
    try {
      const readiness = loadLaunchReadiness(root);
      assert.deepEqual(readiness, {
        ready: false,
        source: "none",
        apps: []
      });
      const summary = formatReadinessSummary(readiness);
      assert.match(summary, /Launch not ready/);
      const block = formatPlatformOpsBlock({
        executionTarget: "local",
        isWorkspace: false
      });
      assert.match(block, /upsert_launch_app/);
      assert.match(block, /preview_start/);
      assert.match(block, /40000–49999/);
      assert.match(block, /FORGE_PUBLISHED_APP_PORTS/);
      assert.match(block, /get_workspace_health/);
      assert.doesNotMatch(block, /Eval: not agent-ready/);
      assert.doesNotMatch(block, /container ports/);
      assert.doesNotMatch(block, /npm\/yarn\/pnpm/);
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
      const summary = formatReadinessSummary(readiness);
      assert.match(summary, /Launch ready/);
      assert.match(summary, /`web` \(web\)/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("does not read root forge.json (launch.json only)", async () => {
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
      assert.equal(readiness.ready, false);
      assert.equal(readiness.source, "none");
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
      const summary = formatReadinessSummary(readiness);
      assert.match(summary, /bp-frontend/);
      assert.match(summary, /bp-backend/);
      const block = formatPlatformOpsBlock({
        executionTarget: "cloud",
        isWorkspace: true,
        memberRepos: ["bp-backend", "bp-frontend"]
      });
      assert.match(block, /\/workspace\/\.forge\/launch\.json/);
      assert.match(block, /invoke_skill/);
      assert.match(block, /sandbox ports/);
      assert.match(block, /setup_project_infra/);
      assert.doesNotMatch(block, /Eval: agent-ready/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
