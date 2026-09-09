import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("launchCwd", { concurrency: false }, () => {
  let existing = new Set<string>();
  let normalizeLaunchCwd: typeof import("./launchCwd.js").normalizeLaunchCwd;
  let resolveLaunchAppDir: typeof import("./launchCwd.js").resolveLaunchAppDir;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        pathExistsInSandbox: async (opts: { absPath: string }) =>
          existing.has(opts.absPath)
      }
    });
    ({ normalizeLaunchCwd, resolveLaunchAppDir } =
      await import("./launchCwd.js"));
  });

  it("normalizeLaunchCwd maps repo folder name to .", () => {
    assert.equal(
      normalizeLaunchCwd({ cwd: "portfolio", repoDir: "portfolio" }),
      "."
    );
    assert.equal(
      normalizeLaunchCwd({ cwd: "apps/web", repoDir: "portfolio" }),
      "apps/web"
    );
    assert.equal(normalizeLaunchCwd({ cwd: ".", repoDir: "portfolio" }), ".");
    assert.equal(normalizeLaunchCwd({ cwd: "./", repoDir: "portfolio" }), ".");
  });

  it("resolveLaunchAppDir uses workingDir when cwd is .", async () => {
    existing = new Set(["/workspace"]);
    const r = await resolveLaunchAppDir({
      containerName: "c",
      sessionId: "s1",
      workingDir: "/workspace",
      repoDir: "portfolio",
      cwd: "."
    });
    assert.equal(r.appDir, "/workspace");
    assert.equal(r.relCwd, ".");
    assert.equal(r.error, undefined);
  });

  it("resolveLaunchAppDir remaps missing repo-name cwd to workingDir", async () => {
    existing = new Set(["/workspace"]);
    const r = await resolveLaunchAppDir({
      containerName: "c",
      sessionId: "s1",
      workingDir: "/workspace",
      repoDir: "portfolio",
      cwd: "portfolio"
    });
    assert.equal(r.appDir, "/workspace");
    assert.equal(r.relCwd, ".");
    assert.equal(r.error, undefined);
  });

  it("resolveLaunchAppDir keeps a real nested folder named like the repo", async () => {
    existing = new Set(["/workspace", "/workspace/portfolio"]);
    const r = await resolveLaunchAppDir({
      containerName: "c",
      sessionId: "s1",
      workingDir: "/workspace",
      repoDir: "portfolio",
      cwd: "portfolio"
    });
    assert.equal(r.appDir, "/workspace/portfolio");
    assert.equal(r.relCwd, "portfolio");
  });

  it("resolveLaunchAppDir errors when cwd is missing", async () => {
    existing = new Set(["/workspace"]);
    const r = await resolveLaunchAppDir({
      containerName: "c",
      sessionId: "s1",
      workingDir: "/workspace",
      repoDir: "portfolio",
      cwd: "apps/missing"
    });
    assert.match(r.error ?? "", /App cwd not found/);
  });
});
