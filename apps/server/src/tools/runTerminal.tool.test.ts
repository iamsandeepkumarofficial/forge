import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTerminalAction,
  resolveTerminalCwd
} from "./runTerminal.tool.js";

describe("parseTerminalAction", () => {
  it("accepts known actions", () => {
    assert.equal(parseTerminalAction("run"), "run");
    assert.equal(parseTerminalAction("logs"), "logs");
    assert.equal(parseTerminalAction("status"), "status");
    assert.equal(parseTerminalAction("stop"), "stop");
  });

  it("rejects unknown values", () => {
    assert.equal(parseTerminalAction("kill"), undefined);
    assert.equal(parseTerminalAction(1), undefined);
    assert.equal(parseTerminalAction(undefined), undefined);
  });
});

describe("resolveTerminalCwd", () => {
  const base = {
    containerName: "c",
    repoDir: "frontend",
    workingDir: "/workspace",
    command: "ls"
  };

  it("defaults project sessions to /workspace", async () => {
    assert.deepEqual(await resolveTerminalCwd(base), {
      cwd: "/workspace"
    });
    assert.deepEqual(
      await resolveTerminalCwd({ ...base, workingDirectory: "frontend" }),
      { cwd: "/workspace" }
    );
  });

  it("defaults single-member workspace to the member mount", async () => {
    const r = await resolveTerminalCwd({
      ...base,
      worktrees: { frontend: "/workspace/frontend" }
    });
    assert.deepEqual(r, { cwd: "/workspace/frontend" });
  });

  it("resolves member repo name to its mount in workspaces", async () => {
    const worktrees = {
      frontend: "/workspace/frontend",
      backend: "/workspace/backend"
    };
    assert.deepEqual(
      await resolveTerminalCwd({
        ...base,
        worktrees,
        workingDirectory: "backend"
      }),
      { cwd: "/workspace/backend" }
    );
    assert.deepEqual(
      await resolveTerminalCwd({
        ...base,
        worktrees,
        workingDirectory: "frontend"
      }),
      { cwd: "/workspace/frontend" }
    );
  });

  it("keeps multi-member default at session root", async () => {
    const r = await resolveTerminalCwd({
      ...base,
      worktrees: {
        frontend: "/workspace/frontend",
        backend: "/workspace/backend"
      }
    });
    assert.deepEqual(r, { cwd: "/workspace" });
  });

  it("resolves nested paths under known member repos", async () => {
    const r = await resolveTerminalCwd({
      ...base,
      worktrees: { frontend: "/workspace/frontend" },
      workingDirectory: "frontend/apps/web"
    });
    assert.deepEqual(r, { cwd: "/workspace/frontend/apps/web" });
  });
});
