import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { envKeyAliases, envKeySatisfied } from "./envKeyAliases.js";

describe("envKeyAliases", () => {
  it("maps mongo and postgres aliases both ways", () => {
    assert.deepEqual(envKeyAliases("MONGODB_URL"), ["MONGODB_URI"]);
    assert.deepEqual(envKeyAliases("MONGODB_URI"), ["MONGODB_URL"]);
    assert.ok(envKeyAliases("DATABASE_URL").includes("POSTGRESDB_URL"));
  });

  it("envKeySatisfied accepts aliases with non-empty presence in the set", () => {
    const keys = new Set(["MONGODB_URI"]);
    assert.equal(envKeySatisfied(keys, "MONGODB_URL"), true);
    assert.equal(envKeySatisfied(keys, "MONGODB_URI"), true);
    assert.equal(envKeySatisfied(keys, "JWT_SECRET"), false);
  });
});
