import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("executeInstallProjectInfra", () => {
  let executeInstallProjectInfra: typeof import("./installProjectInfra.tool.js").executeInstallProjectInfra;
  let host = true;
  let installFn: (
    id: string,
    opts?: { version?: string }
  ) => Promise<{
    dependencyId: string;
    version: string;
    reused: boolean;
    binDir: string;
    installRoot: string;
    binaries: Record<string, string>;
  }>;

  before(async () => {
    installFn = async (id) => ({
      dependencyId: id,
      version: "7.0.14",
      reused: false,
      binDir: "/tmp/forge-runtime/mongo/7.0.14/bin",
      installRoot: "/tmp/forge-runtime/mongo/7.0.14",
      binaries: { mongod: "/tmp/forge-runtime/mongo/7.0.14/bin/mongod" }
    });
    mock.module("../projects/sandboxRuntime/resolve.js", {
      exports: {
        isHostSession: async () => host
      }
    });
    mock.module("../projects/hostInfra/install.js", {
      exports: {
        installProjectInfraDependency: (
          id: string,
          opts?: { version?: string }
        ) => installFn(id, opts)
      }
    });
    ({ executeInstallProjectInfra } =
      await import("./installProjectInfra.tool.js"));
  });

  it("requires userApproved", async () => {
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "mongo" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /userApproved/);
  });

  it("rejects unknown dependencyId", async () => {
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "redis", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /Unknown dependencyId/);
  });

  it("blocks host-only deps on cloud sessions", async () => {
    host = false;
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "mongo", userApproved: true }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /local \(host\) sessions only/);
    host = true;
  });

  it("installs on host and points at setup_project_infra", async () => {
    host = true;
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "mongo", userApproved: true }
    });
    assert.equal(r.success, true);
    assert.match(r.output, /setup_project_infra/);
    assert.equal(r.metadata?.dependencyId, "mongo");
  });

  it("rejects node-20 with alias hint", async () => {
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "node-20", userApproved: true, version: "20" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /dependencyId=`node`/);
  });

  it("installs node without pointing at setup_project_infra", async () => {
    host = true;
    installFn = async (id) => ({
      dependencyId: id,
      version: "20.20.2",
      reused: false,
      binDir: "/tmp/forge-runtime/node/20.20.2/bin",
      installRoot: "/tmp/forge-runtime/node/20.20.2",
      binaries: {
        node: "/tmp/forge-runtime/node/20.20.2/bin/node",
        npm: "/tmp/forge-runtime/node/20.20.2/bin/npm",
        npx: "/tmp/forge-runtime/node/20.20.2/bin/npx"
      }
    });
    const r = await executeInstallProjectInfra({
      sessionId: "s1",
      args: { dependencyId: "node", userApproved: true, version: "20" }
    });
    assert.equal(r.success, true);
    assert.match(r.output, /get_workspace_health|node -v/);
    assert.ok(!/Next: call setup_project_infra/.test(r.output));
    assert.equal(r.metadata?.needsSetup, false);
  });
});
