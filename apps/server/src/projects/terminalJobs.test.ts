import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("terminalJobs", { concurrency: false }, () => {
  let lsOut = "";
  let metaRaw: string | null = null;
  let running = true;
  let listTerminalJobNames: typeof import("./terminalJobs.js").listTerminalJobNames;
  let listTerminalJobStatuses: typeof import("./terminalJobs.js").listTerminalJobStatuses;
  let readTerminalJobMeta: typeof import("./terminalJobs.js").readTerminalJobMeta;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        dockerExec: async () => ({ code: 0, stdout: lsOut, stderr: "" }),
        readFileFromSandbox: async () => metaRaw,
        writeFileToSandbox: async () => undefined
      }
    });
    mock.module("./backgroundJob.js", {
      exports: {
        sanitizeJobName: (n: string) => n,
        isBackgroundJobRunning: async () => running,
        readBackgroundJobLogs: async () => "log",
        stopBackgroundJob: async () => undefined
      }
    });
    ({ listTerminalJobNames, listTerminalJobStatuses, readTerminalJobMeta } =
      await import("./terminalJobs.js"));
  });

  it("parses job names from pid/log/meta files", async () => {
    lsOut = [
      "/tmp/forge-term-install.pid",
      "/tmp/forge-term-install.log",
      "/tmp/forge-term-t1.meta"
    ].join("\n");
    assert.deepEqual(await listTerminalJobNames("c"), ["install", "t1"]);
  });

  it("reads meta and lists running status", async () => {
    lsOut = "/tmp/forge-term-install.meta\n";
    metaRaw = JSON.stringify({
      command: "pnpm i",
      cwd: "/workspace",
      startedAt: "2026-01-01T00:00:00.000Z"
    });
    running = true;
    const meta = await readTerminalJobMeta({
      containerName: "c",
      name: "install"
    });
    assert.equal(meta?.command, "pnpm i");
    const jobs = await listTerminalJobStatuses("c");
    assert.equal(jobs[0]?.name, "install");
    assert.equal(jobs[0]?.running, true);
    assert.equal(jobs[0]?.command, "pnpm i");
  });
});
