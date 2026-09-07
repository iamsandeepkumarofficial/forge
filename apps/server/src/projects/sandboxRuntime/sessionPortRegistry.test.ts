import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  allocateSessionPort,
  listSessionPortAllocations,
  portsForSession,
  releaseSessionPorts,
  resetSessionPortRegistryForTests
} from "./sessionPortRegistry.js";

describe("sessionPortRegistry", () => {
  const prev = process.env.FORGE_SESSIONS_ROOT;
  let tmp = "";

  afterEach(async () => {
    resetSessionPortRegistryForTests();
    if (prev === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prev;
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("allocates distinct ports per session and releases them", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ports-"));
    process.env.FORGE_SESSIONS_ROOT = tmp;

    const a = await allocateSessionPort("s1");
    const b = await allocateSessionPort("s2");
    assert.notEqual(a, b);
    assert.deepEqual(portsForSession("s1"), [a]);
    assert.equal(listSessionPortAllocations().length, 2);

    await releaseSessionPorts("s1");
    assert.deepEqual(portsForSession("s1"), []);
    const reused = await allocateSessionPort("s3", a);
    assert.equal(reused, a);
  });
});
