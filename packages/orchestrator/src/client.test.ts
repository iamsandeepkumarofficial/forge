import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientConnectionOptions, createClient } from "./client.js";
import { env } from "./env.js";

describe("client", () => {
  it("clientConnectionOptions mirrors env temporal settings", () => {
    assert.deepEqual(clientConnectionOptions(), {
      address: env.temporalAddress,
      namespace: env.temporalNamespace
    });
  });

  it("createClient is an async function", () => {
    assert.equal(typeof createClient, "function");
    assert.equal(createClient.constructor.name, "AsyncFunction");
  });
});
