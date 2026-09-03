import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  connectionUrlFor,
  detectEnginesFromFacts,
  getAppDbEngine,
  workspaceDbName
} from "./engines.js";

describe("appDb engines", () => {
  it("names a workspace database from the workspace id", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      workspaceDbName(id),
      "forge_ws_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee"
    );
  });

  it("builds sandbox connection URLs without leaking extra engines", () => {
    const pg = getAppDbEngine("postgres")!;
    const url = connectionUrlFor(pg, "forge_ws_demo");
    assert.match(url, /^postgresql:\/\/forge:forge@postgres-apps:5432\/forge_ws_demo$/);
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
