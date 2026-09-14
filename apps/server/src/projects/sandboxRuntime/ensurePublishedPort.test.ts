import assert from "node:assert/strict";
import net from "node:net";
import { after, describe, it } from "node:test";
import { ensureHostTcpPublishedReady } from "./ensurePublishedPort.js";

describe("ensurePublishedPort", () => {
  it("returns false quickly when nothing listens", async () => {
    const ok = await ensureHostTcpPublishedReady({
      publishedPort: 59_999,
      tries: 1,
      intervalMs: 0
    });
    assert.equal(ok, false);
  });

  it("returns true when TCP is listening", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const port = addr.port;
    after(() => {
      server.close();
    });
    const ok = await ensureHostTcpPublishedReady({
      publishedPort: port,
      tries: 2,
      intervalMs: 0
    });
    assert.equal(ok, true);
    server.close();
  });
});
