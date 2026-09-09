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
    binaries: Record<string, string>;
  }>;

  before(async () => {
    installFn = async (id) => ({
      dependencyId: id,
      version: "7.0.14",
      reused: false,
      binDir: "/tmp/forge-runtime/bin",
      binaries: { mongod: "/tmp/forge-runtime/bin/mongod" }
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
});
