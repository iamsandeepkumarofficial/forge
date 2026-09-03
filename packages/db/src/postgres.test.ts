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

  it("connectPostgres rejects when the database is unreachable", async () => {
    process.env.DATABASE_URL =
      "postgresql://forge:forge@127.0.0.1:1/forge_test_unused";
    await assert.rejects(() => connectPostgres(), /PostgreSQL connect failed/i);
    assert.throws(() => getDb(), /not initialized/i);
  });

  it("closePostgres is a no-op when never connected", async () => {
    await closePostgres();
    assert.throws(() => getDb(), /not initialized/i);
  });
});
