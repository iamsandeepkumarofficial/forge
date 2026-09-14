import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dockerExecAttach } from "./dockerExecHttp.js";

const execFileAsync = promisify(execFile);

async function runningSandboxContainer(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "ps",
      "--filter",
      "label=forge.sandbox=1",
      "--format",
      "{{.Names}}"
    ]);
    const name = stdout.trim().split("\n")[0]?.trim();
    return name || null;
  } catch {
    return null;
  }
}

describe("dockerExecAttach integration", { skip: !process.env.FORGE_DOCKER_INTEGRATION }, () => {
  it("creates exec and returns an id", async () => {
    const container = await runningSandboxContainer();
    if (!container) return;
    let closed = false;
    const attach = await dockerExecAttach({
      container,
      cmd: ["echo", "hello"],
      onData: () => undefined,
      onClose: () => {
        closed = true;
      }
    });
    assert.ok(attach.execId);
    attach.close();
    assert.equal(closed, true);
  });
});
