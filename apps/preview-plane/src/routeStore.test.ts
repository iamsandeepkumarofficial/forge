import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchPathRoute, RouteStore } from "./routeStore.js";

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

describe("matchPathRoute", () => {
  it("picks longest matching prefix", () => {
    const rule = matchPathRoute(
      [
        { pathPrefix: "/api", backendService: "api:3001" },
        { pathPrefix: "/api/v2", backendService: "api2:3002" },
        { pathPrefix: "/", backendService: "web:3000" }
      ],
      "/api/v2/users?x=1"
    );
    assert.equal(rule?.backendService, "api2:3002");
  });

  it("falls back to catch-all", () => {
    const rule = matchPathRoute(
      [
        { pathPrefix: "/api", backendService: "api:3001" },
        { pathPrefix: "/", backendService: "web:3000" }
      ],
      "/dashboard"
    );
    assert.equal(rule?.backendService, "web:3000");
  });
});
