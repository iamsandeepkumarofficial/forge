import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("PreviewToolService", { concurrency: false }, () => {
  let runAppRunning = true;
  const runApp = mock.fn(async () => ({
    name: "web",
    type: "web",
    cwd: ".",
    command: "pnpm dev",
    running: runAppRunning,
    url: runAppRunning ? "http://127.0.0.1:3000" : undefined
  }));
  let listExists = false;
  let listSource: "launch" | "none" = "none";
  let listedApps: Array<{ name: string; type: string }> = [];
  let PreviewToolService: new () => {
    stop: (
      sessionId: string,
      args: Record<string, unknown>
    ) => Promise<{ success: boolean; output: string }>;
    status: (
      sessionId: string,
      args: Record<string, unknown>
    ) => Promise<{ success: boolean; output: string }>;
    start: (
      sessionId: string,
      args: Record<string, unknown>
    ) => Promise<{ success: boolean; output: string }>;
    upsert: (
      sessionId: string,
      args: Record<string, unknown>
    ) => Promise<{ success: boolean; output: string }>;
  };

  before(async () => {
    mock.module("../projects/appRunner.js", {
      exports: {
        appLogs: async () => "cwd not found: /workspace/missing",
        listAppStatuses: async () => ({
          exists: listExists,
          source: listSource,
          apps: listedApps
        }),
        readForgeConfig: async () => ({
          exists: listExists,
          source: listSource,
          config: { apps: listedApps }
        }),
        runApp,
        stopApp: async () => undefined,
        upsertLaunchApp: async (_sessionId: string, app: { name: string }) => ({
          apps: [app]
        })
      }
    });
    ({ PreviewToolService } = await import("./preview.tool.js"));
  });

  it("stop requires app name", async () => {
    const svc = new PreviewToolService();
    const r = await svc.stop("s1", {});
    assert.equal(r.success, false);
    assert.match(r.output, /name required/);
  });

  it("status reports missing launch.json when absent", async () => {
    listExists = false;
    listSource = "none";
    listedApps = [];
    const svc = new PreviewToolService();
    const r = await svc.status("s1", {});
    assert.equal(r.success, true);
    assert.match(r.output, /launch\.json/);
  });

  it("start refuses unknown names", async () => {
    listExists = true;
    listSource = "launch";
    listedApps = [{ name: "web", type: "web" }];
    const svc = new PreviewToolService();
    const r = await svc.start("s1", { name: "unknown" });
    assert.equal(r.success, false);
    assert.match(r.output, /not in \.forge\/launch\.json/);
  });

  it("start uses explicit listed name", async () => {
    runApp.mock.resetCalls();
    runAppRunning = true;
    listExists = true;
    listSource = "launch";
    listedApps = [{ name: "web", type: "web" }];
    const svc = new PreviewToolService();
    const r = await svc.start("s1", { name: "web" });
    assert.equal(r.success, true);
    assert.match(r.output, /Started web/);
    assert.equal(runApp.mock.callCount(), 1);
  });

  it("start fails closed when the process is not running", async () => {
    runApp.mock.resetCalls();
    runAppRunning = false;
    listExists = true;
    listSource = "launch";
    listedApps = [{ name: "web", type: "web" }];
    const svc = new PreviewToolService();
    const r = await svc.start("s1", { name: "web" });
    assert.equal(r.success, false);
    assert.match(r.output, /Failed to start web/);
    assert.match(r.output, /cwd not found/);
  });

  it("upsert writes launch app", async () => {
    const svc = new PreviewToolService();
    const r = await svc.upsert("s1", {
      name: "api",
      cwd: "apps/api",
      command: "pnpm dev",
      type: "api",
      port: 3001
    });
    assert.equal(r.success, true);
    assert.match(r.output, /api/);
  });
});
