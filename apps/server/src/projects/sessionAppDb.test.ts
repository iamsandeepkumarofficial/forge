import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeWorkspaceAppDatabases,
  workspaceDbName
} from "./sessionAppDb.js";

describe("sessionAppDb workspace", () => {
  it("derives a postgres-safe workspace database name", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      workspaceDbName(id),
      "forge_ws_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee"
    );
  });

  it("describes network-plane hosts without secrets", () => {
    const status = describeWorkspaceAppDatabases(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      { postgres: true, mongo: false }
    );
    assert.equal(status.network, "forge");
    assert.equal(status.postgres.sandboxHost, "postgres-apps");
    assert.equal(status.postgres.injectedAs, "DATABASE_URL");
    assert.equal(status.mongo.sandboxHost, "mongo-apps");
    assert.doesNotMatch(JSON.stringify(status), /forge:forge/);
  });
});
