import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { isHttpOk, waitForHttp } from "./httpWait.js";

describe("httpWait", () => {
  it("isHttpOk is true for a live 200 and false when down", async () => {
    const server = http.createServer((_req, res) => {
      res.end("ok");
    });
    await listen(server);
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/`;
    assert.equal(await isHttpOk(url), true);
    await close(server);
    assert.equal(await isHttpOk(url), false);
  });

  it("waitForHttp resolves when the server appears", async () => {
    const server = http.createServer((_req, res) => {
      res.end("ok");
    });
    await listen(server);
    const { port } = server.address() as AddressInfo;
    await waitForHttp({
      url: `http://127.0.0.1:${port}/`,
      attempts: 4,
      intervalMs: 10
    });
    await close(server);
  });

  it("waitForHttp throws after attempts", async () => {
    await assert.rejects(
      () =>
        waitForHttp({
          url: "http://127.0.0.1:1/",
          attempts: 2,
          intervalMs: 10
        }),
      /timed out/
    );
  });
});

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
