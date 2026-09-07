import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appDbInjectionHint,
  connectionUrlFor,
  detectEnginesFromFacts,
  getAppDbEngine,
  workspaceDbName
} from "./engines.js";

describe("appDb engines", () => {
  const prevRuntime = process.env.SANDBOX_RUNTIME;
  const prevDesktop = process.env.FORGE_DESKTOP;

  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.SANDBOX_RUNTIME;
    else process.env.SANDBOX_RUNTIME = prevRuntime;
    if (prevDesktop === undefined) delete process.env.FORGE_DESKTOP;
    else process.env.FORGE_DESKTOP = prevDesktop;
  });

  it("names a workspace database from the workspace id", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      workspaceDbName(id),
      "forge_ws_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee"
    );
  });

  it("builds sandbox connection URLs without leaking extra engines", () => {
    process.env.SANDBOX_RUNTIME = "docker";
    const pg = getAppDbEngine("postgres")!;
    const url = connectionUrlFor(pg, "forge_ws_demo");
    assert.match(
      url,
      /^postgresql:\/\/forge:forge@postgres-apps:5432\/forge_ws_demo$/
    );
  });

  it("builds localhost connection URLs in host mode", () => {
    process.env.SANDBOX_RUNTIME = "host";
    const pg = getAppDbEngine("postgres")!;
    const mongo = getAppDbEngine("mongo")!;
    assert.equal(
      connectionUrlFor(pg, "forge_ws_demo"),
      "postgresql://forge:forge@127.0.0.1:5434/forge_ws_demo"
    );
    assert.equal(
      connectionUrlFor(mongo, "forge_ws_demo"),
      "mongodb://127.0.0.1:27017/forge_ws_demo"
    );
    assert.match(appDbInjectionHint(), /localhost/);
  });

  it("detects postgres and mongo from facts", () => {
    assert.deepEqual(
      detectEnginesFromFacts({
        envKeysReferenced: ["DATABASE_URL", "JWT_SECRET"],
        detectedStack: ["express"]
      }),
      ["postgres"]
    );
    assert.deepEqual(
      detectEnginesFromFacts({
        envKeysReferenced: ["MONGODB_URI"],
        detectedStack: ["mongoose"]
      }),
      ["mongo"]
    );
    assert.deepEqual(
      detectEnginesFromFacts({
        envKeysReferenced: [],
        detectedStack: ["react"]
      }),
      []
    );
  });
});
