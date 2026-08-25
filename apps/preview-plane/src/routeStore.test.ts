import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RouteStore } from "./routeStore.js";

describe("RouteStore", () => {
  it("upserts and looks up by hostname", () => {
    const store = new RouteStore();
    store.upsert({
      sessionId: "abc",
      port: 3000,
      hostname: "s-abc.preview.forge.local",
      backendService: "forge-sess-abc:3000"
    });
    assert.equal(
      store.get("S-abc.preview.forge.local")?.backendService,
      "forge-sess-abc:3000"
    );
  });

  it("revokes all hosts for a session", () => {
    const store = new RouteStore();
    store.upsert({
      sessionId: "abc",
      port: 3000,
      hostname: "s-abc.preview.forge.local",
      backendService: "svc:3000"
    });
    store.upsert({
      sessionId: "abc",
      port: 3001,
      hostname: "p3001-s-abc.preview.forge.local",
      backendService: "svc:3001"
    });
    assert.equal(store.deleteSession("abc"), 2);
    assert.equal(store.get("s-abc.preview.forge.local"), undefined);
  });

  it("revokes a single port", () => {
    const store = new RouteStore();
    store.upsert({
      sessionId: "abc",
      port: 3001,
      hostname: "p3001-s-abc.preview.forge.local",
      backendService: "svc:3001"
    });
    assert.equal(store.deletePort({ sessionId: "abc", port: 3001 }), true);
  });
});
