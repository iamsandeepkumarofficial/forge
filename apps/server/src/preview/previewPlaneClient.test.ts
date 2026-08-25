import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  registerPreviewRoute,
  revokePreviewSession
} from "./previewPlaneClient.js";
import { SandboxRuntimeError } from "../projects/sandboxRuntime/types.js";

describe("previewPlaneClient", () => {
  afterEach(() => {
    delete process.env.PREVIEW_PLANE_URL;
    delete process.env.FORGE_POC_TOKEN;
  });

  it("no-ops register when PREVIEW_PLANE_URL is unset", async () => {
    const result = await registerPreviewRoute({
      sessionId: "s1",
      port: 3000,
      backendService: "svc:3000"
    });
    assert.equal(result, null);
  });

  it("posts register when preview-plane is configured", async () => {
    process.env.PREVIEW_PLANE_URL = "http://preview.internal";
    process.env.FORGE_POC_TOKEN = "tok";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      assert.equal(
        String(input),
        "http://preview.internal/internal/preview/register"
      );
      assert.equal(init?.method, "POST");
      return new Response(
        JSON.stringify({
          hostname: "s-s1.preview.forge.local",
          url: "http://s-s1.preview.forge.local"
        }),
        { status: 200 }
      );
    };
    try {
      const result = await registerPreviewRoute({
        sessionId: "s1",
        port: 3000,
        backendService: "svc:3000"
      });
      assert.equal(result?.hostname, "s-s1.preview.forge.local");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws preview_route_failed on non-ok register", async () => {
    process.env.PREVIEW_PLANE_URL = "http://preview.internal";
    process.env.FORGE_POC_TOKEN = "tok";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("nope", { status: 500 });
    try {
      await assert.rejects(
        () =>
          registerPreviewRoute({
            sessionId: "s1",
            port: 3000,
            backendService: "svc:3000"
          }),
        (err: unknown) =>
          err instanceof SandboxRuntimeError &&
          err.code === "preview_route_failed"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("revokes when configured", async () => {
    process.env.PREVIEW_PLANE_URL = "http://preview.internal";
    process.env.FORGE_POC_TOKEN = "tok";
    const originalFetch = globalThis.fetch;
    let deleted = "";
    globalThis.fetch = async (input, init) => {
      deleted = String(input);
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    };
    try {
      await revokePreviewSession("s1");
      assert.ok(deleted.endsWith("/internal/preview/s1"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
