import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createPreviewApp } from "./app.js";
import { RouteStore } from "./routeStore.js";

const TOKEN = "gw-token";
const N_200 = 200;
const N_401 = 401;
const N_403 = 403;
const N_404 = 404;

describe("preview gateway auth", () => {
  const store = new RouteStore();
  const app = createPreviewApp({
    token: TOKEN,
    store,
    previewBaseDomain: "preview.forge.local",
    previewScheme: "http"
  });
  let base = "";
  let upstreamUrl = "";
  let server: ReturnType<typeof app.listen>;
  let upstream: http.Server;

  before(async () => {
    upstream = http.createServer((_req, res) => {
      res.end("upstream-ok");
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, "127.0.0.1", () => resolve());
    });
    const upAddr = upstream.address() as AddressInfo;
    upstreamUrl = `127.0.0.1:${upAddr.port}`;
    store.upsert({
      sessionId: "abc",
      port: 3000,
      hostname: "s-abc.preview.forge.local",
      backendService: upstreamUrl,
      ownerEmail: "alice@x.com"
    });
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
    await new Promise<void>((resolve, reject) => {
      upstream.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("returns 401 without credentials", async () => {
    const res = await fetch(base, {
      headers: { "X-Forwarded-Host": "s-abc.preview.forge.local" }
    });
    assert.equal(res.status, N_401);
    assert.notEqual(await res.text(), "upstream-ok");
  });

  it("returns 403 for authenticated non-owner", async () => {
    const res = await fetch(base, {
      headers: {
        "X-Forwarded-Host": "s-abc.preview.forge.local",
        Authorization: `Bearer ${TOKEN}`,
        "X-Forge-User-Email": "bob@x.com"
      }
    });
    assert.equal(res.status, N_403);
    assert.notEqual(await res.text(), "upstream-ok");
  });

  it("returns 404 when route is missing", async () => {
    const res = await fetch(base, {
      headers: {
        "X-Forwarded-Host": "s-missing.preview.forge.local",
        Authorization: `Bearer ${TOKEN}`,
        "X-Forge-User-Email": "alice@x.com"
      }
    });
    assert.equal(res.status, N_404);
  });

  it("proxies when authenticated owner is allowed", async () => {
    const res = await fetch(base, {
      headers: {
        "X-Forwarded-Host": "s-abc.preview.forge.local",
        Authorization: `Bearer ${TOKEN}`,
        "X-Forge-User-Email": "alice@x.com"
      }
    });
    assert.equal(res.status, N_200);
    assert.equal(await res.text(), "upstream-ok");
  });
});
