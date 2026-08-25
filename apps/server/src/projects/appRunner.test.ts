import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("appRunner", { concurrency: false }, () => {
  let readFileImpl: () => Promise<string | null> = async () => null;
  let written = "";
  let sandboxInfo = {
    containerName: "c",
    workingDir: "/workspace",
    repoDir: "repo"
  };
  let readForgeConfig: (sessionId: string) => Promise<{
    exists: boolean;
    config: { apps: Array<{ name: string }> };
  }>;
  let upsertLaunchApp: typeof import("./appRunner.js").upsertLaunchApp;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        resolveSandbox: async () => sandboxInfo,
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" }),
        readFileFromSandbox: async () => readFileImpl(),
        writeFileToSandbox: async (opts: { content: string }) => {
          written = opts.content;
        },
        pathExistsInSandbox: async () => true
      }
    });
    ({ readForgeConfig, upsertLaunchApp } = await import("./appRunner.js"));
  });

  it("readForgeConfig returns empty when file missing", async () => {
    readFileImpl = async () => null;
    const r = await readForgeConfig("s1");
    assert.deepEqual(r, {
      exists: false,
      source: "none",
      config: { apps: [] }
    });
  });

  it("readForgeConfig parses apps array", async () => {
    readFileImpl = async () =>
      JSON.stringify({
        apps: [
          {
            name: "web",
            cwd: ".",
            command: "pnpm dev",
            type: "web",
            port: 3000
          }
        ]
      });
    const r = await readForgeConfig("s1");
    assert.equal(r.exists, true);
    assert.equal(r.source, "launch");
    assert.equal(r.config.apps[0]!.name, "web");
  });

  it("upsertLaunchApp rewrites repo-name cwd to .", async () => {
    sandboxInfo = {
      containerName: "c",
      workingDir: "/workspace",
      repoDir: "portfolio"
    };
    readFileImpl = async () => JSON.stringify({ apps: [] });
    written = "";
    const next = await upsertLaunchApp("s1", {
      name: "next-dev",
      cwd: "portfolio",
      command: "npm run dev",
      type: "web",
      port: 3000
    });
    assert.equal(next.apps[0]!.cwd, ".");
    assert.match(written, /"cwd": "\."/);
  });
});
