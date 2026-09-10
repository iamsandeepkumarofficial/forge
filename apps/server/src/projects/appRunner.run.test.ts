import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("runApp readiness", { concurrency: false }, () => {
  let jobRunning = true;
  let tcpListening = true;
  let publishedReady = true;
  let stopCount = 0;
  let publishedPorts: number[] = [];
  let listenPortResolved = 3000;
  let runApp: typeof import("./appRunner.js").runApp;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "c",
          workingDir: "/workspace",
          repoDir: "repo"
        }),
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" }),
        readFileFromSandbox: async () =>
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
          }),
        writeFileToSandbox: async () => undefined,
        pathExistsInSandbox: async () => true
      }
    });
    mock.module("./launchCwd.js", {
      exports: {
        normalizeLaunchCwd: (opts: { cwd: string }) => opts.cwd,
        safeRelDir: (cwd: string) => cwd.replace(/^\.\//, "") || ".",
        resolveLaunchAppDir: async () => ({
          appDir: "/workspace",
          relCwd: ".",
          error: undefined
        })
      }
    });
    mock.module("./backgroundJob.js", {
      exports: {
        startBackgroundJob: async () => undefined,
        stopBackgroundJob: async () => {
          stopCount += 1;
        },
        freeListeningPort: async () => undefined,
        waitUntilJobRunning: async () => jobRunning,
        waitUntilTcpListening: async () => tcpListening,
        waitUntilHostTcpListening: async () => tcpListening,
        isBackgroundJobRunning: async () =>
          jobRunning && tcpListening && publishedReady,
        readBackgroundJobLogs: async () => "boot failed"
      }
    });
    mock.module("./sessionSandbox.js", {
      exports: {
        hostPortForContainerPort: () => 13000,
        sessionHostPortBase: () => 13000,
        FIRST_APP_PORT: 3000,
        LAST_APP_PORT: 3009,
        RESERVED_PORTS: 10,
        isReservedAppPort: (port: number) => port >= 3000 && port <= 3009,
        allocateReservedAppPort: (used: Iterable<number>) => {
          const taken = new Set(used);
          for (let p = 3000; p <= 3009; p++) {
            if (!taken.has(p)) return p;
          }
          return null;
        }
      }
    });
    mock.module("./sandboxRuntime/resolve.js", {
      exports: {
        isHostSession: async () => false,
        resolveSandboxRuntimeKindForSession: async () => "docker",
        getSandboxRuntime: async () => ({
          kind: "docker",
          resolveListenPort: async () => listenPortResolved,
          resolvePublishedPort: async () => 13000,
          ensurePublishedPortReady: async () => publishedReady,
          publishedAppPortsEnv: () => "3000-3009",
          isAllowedListenPort: (port: number) => port >= 3000 && port <= 3009,
          previewHostname: (sessionId: string, _port: number) =>
            `s-${sessionId}.preview.local`,
          publishPreviewPort: async (
            _handle: unknown,
            port: number
          ): Promise<void> => {
            publishedPorts.push(port);
          }
        })
      }
    });
    ({ runApp } = await import("./appRunner.js"));
  });

  it("publishes preview only after TCP listens", async () => {
    jobRunning = true;
    tcpListening = true;
    publishedReady = true;
    stopCount = 0;
    publishedPorts = [];
    listenPortResolved = 3000;
    const status = await runApp("s1", "web");
    assert.equal(status.running, true);
    assert.equal(status.startFailure, undefined);
    assert.deepEqual(publishedPorts, [3000]);
    assert.ok(stopCount >= 1);
  });

  it("stops job and skips publish when published port never ready", async () => {
    jobRunning = true;
    tcpListening = true;
    publishedReady = false;
    stopCount = 0;
    publishedPorts = [];
    listenPortResolved = 3000;
    const status = await runApp("s1", "web");
    assert.equal(status.running, false);
    assert.equal(status.startFailure, "port");
    assert.deepEqual(publishedPorts, []);
    assert.ok(stopCount >= 2);
  });
});
