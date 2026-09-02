import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("launchScaffold", { concurrency: false }, () => {
  let launchRaw: string | null = null;
  let written = "";
  let packageByPath = new Map<string, string | null>();
  let appsListing = "";
  let seedResult = false;
  let ensureLaunchConfig: typeof import("./launchScaffold.js").ensureLaunchConfig;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "c",
          workingDir: "/workspace",
          repoDir: "repo"
        }),
        dockerExec: async (opts: { argv: string[] }) => {
          const script = opts.argv.join(" ");
          if (script.includes("pnpm-lock")) {
            return { code: 0, stdout: "npm", stderr: "" };
          }
          if (script.includes('ls -1 "/workspace/apps"')) {
            return { code: 0, stdout: appsListing, stderr: "" };
          }
          return { code: 0, stdout: "", stderr: "" };
        },
        readFileFromSandbox: async (_c: string, absPath: string) => {
          if (absPath.endsWith(".forge/launch.json")) {
            return launchRaw;
          }
          if (absPath.endsWith("pulse.json")) {
            return null;
          }
          if (packageByPath.has(absPath)) {
            return packageByPath.get(absPath) ?? null;
          }
          return null;
        },
        writeFileToSandbox: async (opts: { content: string }) => {
          written = opts.content;
          launchRaw = opts.content;
        },
        pathExistsInSandbox: async () => true
      }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            return { workspaceId: "ws-test", sessionId: "s1" };
          }
        }
      }
    });
    mock.module("./workspaceEnvironment.js", {
      exports: {
        seedLaunchFromWorkspace: async () => {
          if (!seedResult) return false;
          written = JSON.stringify({
            apps: [
              {
                name: "saved-web",
                cwd: "bp-frontend",
                command: "yarn dev",
                type: "web",
                port: 3000,
                repo: "bp-frontend"
              }
            ]
          });
          launchRaw = written;
          return true;
        }
      }
    });
    ({ ensureLaunchConfig } = await import("./launchScaffold.js"));
  });

  it("no-ops when launch.json already has apps", async () => {
    launchRaw = JSON.stringify({
      apps: [
        {
          name: "web",
          cwd: "apps/web",
          command: "npm run dev",
          type: "web",
          port: 3000
        }
      ]
    });
    written = "";
    seedResult = true;
    appsListing = "web";
    const r = await ensureLaunchConfig("s1");
    assert.deepEqual(r, { ready: true, scaffolded: false, source: "existing" });
    assert.equal(written, "");
  });

  it("seeds from workspace when session launch is empty", async () => {
    launchRaw = null;
    written = "";
    seedResult = true;
    appsListing = "";
    packageByPath = new Map();
    const r = await ensureLaunchConfig("s2");
    assert.deepEqual(r, {
      ready: true,
      scaffolded: false,
      seeded: true,
      source: "seeded"
    });
    assert.match(written, /saved-web/);
  });

  it("writes when missing and detectApps finds apps", async () => {
    launchRaw = null;
    written = "";
    seedResult = false;
    appsListing = "web";
    packageByPath = new Map([
      [
        "/workspace/apps/web/package.json",
        JSON.stringify({
          name: "web",
          scripts: { dev: "vite" },
          dependencies: { vite: "5.0.0" }
        })
      ]
    ]);
    const r = await ensureLaunchConfig("s1");
    assert.deepEqual(r, { ready: true, scaffolded: true, source: "scaffolded" });
    assert.match(written, /"name": "web"/);
    assert.match(written, /"cwd": "apps\/web"/);
  });

  it("does not write empty launch.json when nothing detected", async () => {
    launchRaw = null;
    written = "";
    seedResult = false;
    appsListing = "";
    packageByPath = new Map();
    const r = await ensureLaunchConfig("s1");
    assert.deepEqual(r, { ready: false, scaffolded: false, source: "none" });
    assert.equal(written, "");
  });
});
