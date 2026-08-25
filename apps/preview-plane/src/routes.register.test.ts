import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewInternalRouter } from "./routes.js";
import { RouteStore } from "./routeStore.js";

describe("routes.register", () => {
  it("builds an internal router", () => {
    const router = previewInternalRouter({
      store: new RouteStore(),
      token: "t",
      previewScheme: "http",
      previewBaseDomain: "preview.forge.local"
    });
    assert.equal(typeof router, "function");
  });
});
