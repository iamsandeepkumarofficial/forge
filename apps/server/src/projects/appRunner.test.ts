import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

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
    mock.module("./sandboxRuntime/resolve.js", {
      exports: {
        getSandboxRuntime: async () => ({
          kind: "docker",
          publishedAppPortsEnv: () => "3000-3009",
          isAllowedListenPort: (port: number) => port >= 3000 && port <= 3009,
          resolveListenPort: async (input: { preferred?: number }) =>
            input.preferred ?? 3000
        }),
        isHostSession: async () => false,
        resolveSandboxRuntimeKindForSession: async () => "docker"
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

  it("upsertLaunchApp updates port and keeps port when omitted", async () => {
    sandboxInfo = {
      containerName: "c",
      workingDir: "/workspace",
      repoDir: "repo"
    };
    readFileImpl = async () =>
      JSON.stringify({
        apps: [
          {
            name: "web",
            cwd: ".",
            command: "npm run dev",
            type: "web",
            port: 3000
          }
        ]
      });
    written = "";
    const updated = await upsertLaunchApp("s1", {
      name: "web",
      cwd: ".",
      command: "npm run dev",
      type: "web",
      port: 3002
    });
    assert.equal(updated.apps[0]!.port, 3002);

    const saved = written;
    readFileImpl = async () => saved;
    written = "";
    const kept = await upsertLaunchApp("s1", {
      name: "web",
      cwd: ".",
      command: "npm run dev",
      type: "web"
    });
    assert.equal(kept.apps[0]!.port, 3002);
  });

  it("upsertLaunchApp rejects ports outside 3000–3009", async () => {
    sandboxInfo = {
      containerName: "c",
      workingDir: "/workspace",
      repoDir: "repo"
    };
    readFileImpl = async () => JSON.stringify({ apps: [] });
    await assert.rejects(
      () =>
        upsertLaunchApp("s1", {
          name: "web",
          cwd: ".",
          command: "npm run dev",
          type: "web",
          port: 3010
        }),
      /outside published range/
    );
  });
});
