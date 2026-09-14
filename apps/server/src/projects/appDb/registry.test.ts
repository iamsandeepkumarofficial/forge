import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDbAdapter, listDbSetupEngineIds } from "./registry.js";

describe("appDb registry", () => {
  it("lists setup engine ids from adapters", () => {
    const ids = listDbSetupEngineIds();
    assert.ok(ids.includes("postgres"));
    assert.ok(ids.includes("mongo"));
  });

  it("resolves adapters by id", () => {
    assert.equal(getDbAdapter("postgres")?.id, "postgres");
    assert.equal(getDbAdapter("MONGO")?.setup.engineId, "mongo");
    assert.equal(getDbAdapter("missing"), undefined);
  });
});
