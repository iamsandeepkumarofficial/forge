import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { hostProcessEnv, hostSessionTempDir, scrubHostEnv } from "./hostEnv.js";

describe("hostEnv", () => {
  it("allowlists env and sets TERM default", () => {
    const env = scrubHostEnv({ FORGE_TEST: "x" });
    assert.equal(env.FORGE_TEST, "x");
    assert.ok(env.TERM);
    assert.equal(env.DATABASE_URL, undefined);
    assert.equal(typeof env.PATH, "string");
  });

  it("hostProcessEnv forces temp under session .forge-runtime/tmp", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-host-env-"));
    try {
      const expected = hostSessionTempDir(root);
      const env = await hostProcessEnv(root, { FORGE_TEST: "1" });
      assert.equal(env.TMPDIR, expected);
      assert.equal(env.TEMP, expected);
      assert.equal(env.TMP, expected);
      assert.equal(env.FORGE_TEST, "1");
      const st = await fs.stat(expected);
      assert.ok(st.isDirectory());
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
