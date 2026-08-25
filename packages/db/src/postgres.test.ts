import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { closePostgres, connectPostgres, getDb } from "./postgres.js";

describe("postgres connection helpers", () => {
  afterEach(async () => {
    await closePostgres();
    delete process.env.DATABASE_URL;
  });

  it("getDb throws before connectPostgres", () => {
    assert.throws(() => getDb(), /not initialized/i);
  });

  it("connectPostgres rejects when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await assert.rejects(() => connectPostgres(), /DATABASE_URL/);
  });

  it("connectPostgres initializes getDb without querying", async () => {
    process.env.DATABASE_URL =
      "postgresql://forge:forge@127.0.0.1:1/forge_test_unused";
    await connectPostgres();
    const db = getDb();
    assert.equal(typeof db.select, "function");
    await connectPostgres();
    assert.equal(getDb(), db);
  });

  it("closePostgres clears the initialized client", async () => {
    process.env.DATABASE_URL =
      "postgresql://forge:forge@127.0.0.1:1/forge_test_unused";
    await connectPostgres();
    await closePostgres();
    assert.throws(() => getDb(), /not initialized/i);
  });
});
