import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("runApp readiness", { concurrency: false }, () => {
  let jobRunning = true;
  let tcpListening = true;
  let stopped = false;
  let publishedPorts: number[] = [];
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
          stopped = true;
          jobRunning = false;
        },
        waitUntilJobRunning: async () => jobRunning,
        waitUntilTcpListening: async () => tcpListening,
        isBackgroundJobRunning: async () => jobRunning,
        readBackgroundJobLogs: async () => "boot failed"
      }
    });
    mock.module("./sessionSandbox.js", {
      exports: {
        hostPortForContainerPort: () => 13000,
        FIRST_APP_PORT: 3000,
        RESERVED_PORTS: 20
      }
    });
    mock.module("./sandboxRuntime/resolve.js", {
      exports: {
        resolveSandboxRuntimeKind: () => "docker",
        getSandboxRuntime: () => ({
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
    stopped = false;
    publishedPorts = [];
    const status = await runApp("s1", "web");
    assert.equal(status.running, true);
    assert.equal(status.startFailure, undefined);
    assert.deepEqual(publishedPorts, [3000]);
    assert.equal(stopped, false);
  });

  it("stops job and skips publish when port never listens", async () => {
    jobRunning = true;
    tcpListening = false;
    stopped = false;
    publishedPorts = [];
    const status = await runApp("s1", "web");
    assert.equal(status.running, false);
    assert.equal(status.startFailure, "port");
    assert.deepEqual(publishedPorts, []);
    assert.equal(stopped, true);
  });
});
