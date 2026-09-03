import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
  const state: { statusCode: number; body: unknown; text: string | null } = {
    statusCode: 200,
    body: null,
    text: null
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    type() {
      return res;
    },
    send(text: string) {
      state.text = text;
      state.body = text;
      return res;
    }
  };
  return { res, state };
}

describe("terminal.handlers", { concurrency: false }, () => {
  let handleTerminalJobs: typeof import("./terminal.handlers.js").handleTerminalJobs;
  let handleTerminalLogs: typeof import("./terminal.handlers.js").handleTerminalLogs;
  let handleTerminalStop: typeof import("./terminal.handlers.js").handleTerminalStop;
  let handleTerminalRun: typeof import("./terminal.handlers.js").handleTerminalRun;

  before(async () => {
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({ containerName: "c" })
      }
    });
    mock.module("../../projects/terminalJobs.js", {
      exports: {
        listTerminalJobStatuses: async () => [
          { name: "t1", running: true, command: "pnpm test", cwd: "/workspace" }
        ],
        terminalJobLogs: async () => "ok\n",
        stopTerminalJob: async () => undefined
      }
    });
    mock.module("../../tools/runTerminal.tool.js", {
      exports: {
        runTerminalInSession: async () => ({
          success: true,
          output: "ok\n",
          metadata: { jobName: "u-ls" }
        })
      }
    });
    ({
      handleTerminalJobs,
      handleTerminalLogs,
      handleTerminalStop,
      handleTerminalRun
    } = await import("./terminal.handlers.js"));
  });

  it("requires sessionId", async () => {
    const jobs = mockRes();
    await handleTerminalJobs(
      { query: {}, body: {} } as never,
      jobs.res as never
    );
    assert.equal(jobs.state.statusCode, 400);

    const logs = mockRes();
    await handleTerminalLogs(
      { query: {}, body: {} } as never,
      logs.res as never
    );
    assert.equal(logs.state.statusCode, 400);
  });

  it("lists jobs and returns logs", async () => {
    const jobs = mockRes();
    await handleTerminalJobs(
      { query: { sessionId: "s1" }, body: {} } as never,
      jobs.res as never
    );
    assert.equal(jobs.state.statusCode, 200);
    assert.deepEqual(jobs.state.body, {
      jobs: [
        {
          name: "t1",
          running: true,
          command: "pnpm test",
          cwd: "/workspace"
        }
      ]
    });

    const allLogs = mockRes();
    await handleTerminalLogs(
      { query: { sessionId: "s1" }, body: {} } as never,
      allLogs.res as never
    );
    assert.deepEqual(allLogs.state.body, {
      jobs: [
        {
          name: "t1",
          running: true,
          command: "pnpm test",
          cwd: "/workspace"
        }
      ],
      logs: { t1: "ok\n" }
    });

    const logs = mockRes();
    await handleTerminalLogs(
      { query: { sessionId: "s1", name: "t1" }, body: {} } as never,
      logs.res as never
    );
    assert.equal(logs.state.text, "ok\n");

    const stop = mockRes();
    await handleTerminalStop(
      { query: {}, body: { sessionId: "s1", name: "t1" } } as never,
      stop.res as never
    );
    assert.deepEqual(stop.state.body, { ok: true });

    const run = mockRes();
    await handleTerminalRun(
      { query: {}, body: { sessionId: "s1", command: "ls" } } as never,
      run.res as never
    );
    assert.deepEqual(run.state.body, {
      success: true,
      output: "ok\n",
      metadata: { jobName: "u-ls" }
    });
  });
});
