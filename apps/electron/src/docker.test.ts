import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCapture } from "./docker.js";

describe("docker runCapture", () => {
  it("returns stdout from a successful command", () => {
    const out = runCapture({
      cmd: process.execPath,
      args: ["-e", "process.stdout.write('ok')"],
      cwd: process.cwd()
    });
    assert.equal(out, "ok");
  });

  it("throws when the command fails", () => {
    assert.throws(
      () =>
        runCapture({
          cmd: process.execPath,
          args: ["-e", "process.exit(1)"],
          cwd: process.cwd()
        }),
      /failed/
    );
  });
});
