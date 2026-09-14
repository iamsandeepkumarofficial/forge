import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeChunkedBody,
  dockerExecResizePath,
  parseDockerEndpoint,
  parseHttpResponse
} from "./dockerExecHttp.js";

describe("dockerExecHttp", () => {
  it("parses default unix docker endpoint", () => {
    assert.deepEqual(parseDockerEndpoint(undefined), {
      kind: "unix",
      socketPath: "/var/run/docker.sock"
    });
  });

  it("parses unix and tcp docker hosts", () => {
    assert.deepEqual(parseDockerEndpoint("unix:///var/run/docker.sock"), {
      kind: "unix",
      socketPath: "/var/run/docker.sock"
    });
    assert.deepEqual(parseDockerEndpoint("tcp://127.0.0.1:2375"), {
      kind: "tcp",
      host: "127.0.0.1",
      port: 2375
    });
  });

  it("builds exec resize paths with floored dimensions", () => {
    assert.equal(
      dockerExecResizePath({ execId: "abc123", cols: 80.9, rows: 24.2 }),
      "/exec/abc123/resize?w=80&h=24"
    );
    assert.equal(
      dockerExecResizePath({ execId: "abc123", cols: 0, rows: 0 }),
      "/exec/abc123/resize?w=1&h=1"
    );
  });

  it("decodes chunked docker responses", () => {
    const payload = '{"Id":"abc123"}';
    const raw = Buffer.from(
      `${payload.length.toString(16)}\r\n${payload}\r\n0\r\n\r\n`,
      "utf8"
    );
    const decoded = decodeChunkedBody(raw);
    assert.equal(decoded.complete, true);
    assert.equal(decoded.body.toString("utf8"), payload);
    const response = parseHttpResponse(
      Buffer.from(
        "HTTP/1.1 201 Created\r\nTransfer-Encoding: chunked\r\n\r\n" +
          raw.toString("utf8"),
        "utf8"
      )
    );
    assert.equal(response.statusCode, 201);
    assert.deepEqual(JSON.parse(response.body.toString("utf8")), {
      Id: "abc123"
    });
  });
});
