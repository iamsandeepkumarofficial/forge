import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("runTerminal background", { concurrency: false }, () => {
  let logs = "";
  let running = true;
  let runTerminalInSession: typeof import("./runTerminal.tool.js").runTerminalInSession;

  before(async () => {
    mock.module("../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "c",
          repoDir: "repo",
          workingDir: "/workspace",
          sessionRoot: "/workspace"
        }),
        resolveWorkspacePath: (rel: string) => `/workspace/${rel}`,
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" }),
        pathExistsInSandbox: async () => true,
        writeFileToSandbox: async () => undefined,
        readFileFromSandbox: async () => null
      }
    });
    mock.module("../projects/backgroundJob.js", {
      exports: {
        sanitizeJobName: (n: string) => n,
        startBackgroundJob: async () => undefined,
        waitUntilJobRunning: async () => running
      }
    });
    mock.module("../projects/terminalJobs.js", {
      exports: {
        writeTerminalJobMeta: async () => undefined,
        terminalJobLogs: async () => logs,
        listTerminalJobStatuses: async () => [
          {
            name: "install",
            running: true,
            command: "pnpm i",
            cwd: "/workspace"
          }
        ],
        stopTerminalJob: async () => undefined
      }
    });
    ({ runTerminalInSession } = await import("./runTerminal.tool.js"));
  });

  it("starts a background job and returns jobName", async () => {
    running = true;
    logs = "installing\n";
    const r = await runTerminalInSession({
      sessionId: "s1",
      command: "pnpm i",
      workingDirectory: "repo",
      background: true,
      jobName: "install"
    });
    assert.equal(r.success, true);
    assert.match(r.output, /Background job install is running/);
    assert.match(r.output, /action=logs/);
    assert.equal(r.metadata?.jobName, "install");
    assert.equal(r.metadata?.running, true);
  });

  it("fails background start when cwd is missing", async () => {
    running = false;
    logs = "cwd not found: /workspace/missing\n";
    const r = await runTerminalInSession({
      sessionId: "s1",
      command: "pnpm i",
      workingDirectory: "repo",
      background: true,
      jobName: "install"
    });
    assert.equal(r.success, false);
    assert.match(r.output, /cwd not found/);
  });

  it("polls logs and status", async () => {
    logs = "done\n";
    const logResult = await runTerminalInSession({
      sessionId: "s1",
      command: "",
      action: "logs",
      jobName: "install"
    });
    assert.equal(logResult.success, true);
    assert.match(logResult.output, /done/);

    const status = await runTerminalInSession({
      sessionId: "s1",
      command: "",
      action: "status"
    });
    assert.match(status.output, /name: install/);
  });
});
