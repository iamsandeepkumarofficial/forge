import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRunningAppUrl } from "./status.js";

describe("appRunner status", () => {
  it("resolveRunningAppUrl returns undefined when not running", () => {
    assert.equal(
      resolveRunningAppUrl({
        running: false,
        sessionId: "s1",
        port: 3000,
        hostPort: 18000
      }),
      undefined
    );
  });

  it("resolveRunningAppUrl falls back to local host port", () => {
    const prevDomain = process.env.FORGE_PREVIEW_BASE_DOMAIN;
    const prevPlane = process.env.PREVIEW_PLANE_URL;
    const prevOrigin = process.env.PREVIEW_PUBLIC_ORIGIN;
    delete process.env.FORGE_PREVIEW_BASE_DOMAIN;
    delete process.env.PREVIEW_PLANE_URL;
    delete process.env.PREVIEW_PUBLIC_ORIGIN;
    try {
      assert.equal(
        resolveRunningAppUrl({
          running: true,
          sessionId: "s1",
          port: 3000,
          hostPort: 18000
        }),
        "http://127.0.0.1:18000"
      );
    } finally {
      if (prevDomain !== undefined)
        process.env.FORGE_PREVIEW_BASE_DOMAIN = prevDomain;
      if (prevPlane !== undefined) process.env.PREVIEW_PLANE_URL = prevPlane;
      if (prevOrigin !== undefined)
        process.env.PREVIEW_PUBLIC_ORIGIN = prevOrigin;
    }
  });
});
