import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseDockerEndpoint,
  decodeChunkedBody
} from "./dockerExecHttpCodec.js";

describe("dockerExecHttpCodec", () => {
  it("parses unix and tcp endpoints", () => {
    assert.deepEqual(parseDockerEndpoint(undefined), {
      kind: "unix",
      socketPath: "/var/run/docker.sock"
    });
    assert.deepEqual(parseDockerEndpoint("tcp://127.0.0.1:2375"), {
      kind: "tcp",
      host: "127.0.0.1",
      port: 2375
    });
  });

  it("decodes chunked bodies", () => {
    const payload = '{"ok":true}';
    const raw = Buffer.from(
      `${payload.length.toString(16)}\r\n${payload}\r\n0\r\n\r\n`,
      "utf8"
    );
    const decoded = decodeChunkedBody(raw);
    assert.equal(decoded.complete, true);
    assert.equal(decoded.body.toString("utf8"), payload);
  });
});
