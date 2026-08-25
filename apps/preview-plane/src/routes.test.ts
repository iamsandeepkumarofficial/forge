import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import type { AddressInfo } from "node:net";
import { createPreviewApp } from "./app.js";
import { RouteStore } from "./routeStore.js";

const TOKEN = "test-internal-token";
const N_200 = 200;
const N_204 = 204;
const N_401 = 401;

describe("preview register/revoke API", () => {
  const store = new RouteStore();
  const app = createPreviewApp({
    token: TOKEN,
    store,
    previewBaseDomain: "preview.forge.local",
    previewScheme: "http"
  });
  let base = "";
  let server: ReturnType<typeof app.listen>;

  before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) =>
      server.once("listening", () => resolve())
    );
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("rejects unauthenticated register", async () => {
    const res = await fetch(`${base}/internal/preview/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "abc",
        port: 3000,
        backendService: "svc:3000"
      })
    });
    assert.equal(res.status, N_401);
  });

  it("registers then revokes a session", async () => {
    const registered = await fetch(`${base}/internal/preview/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        sessionId: "abc",
        port: 3000,
        backendService: "127.0.0.1:3999",
        ownerEmail: "alice@x.com"
      })
    });
    assert.equal(registered.status, N_200);
    const body = (await registered.json()) as { hostname: string; url: string };
    assert.equal(body.hostname, "s-abc.preview.forge.local");
    assert.ok(body.url.startsWith("http://"));

    const revoked = await fetch(`${base}/internal/preview/abc`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    assert.equal(revoked.status, N_204);
    assert.equal(store.get("s-abc.preview.forge.local"), undefined);
  });
});
