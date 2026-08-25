import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { CanonicalRepo } from "./canonicalRepo.js";

describe("CanonicalRepo", () => {
  it("syncToBucket creates local bare-repo dirs and releases lock", async () => {
    const repo = new CanonicalRepo();
    const projectId = `test-${Date.now()}`;
    await repo.syncToBucket({
      projectId,
      bucket: "b",
      key: "k"
    });
    const dir = path.join(process.cwd(), ".bare-repo", projectId);
    const st = await fs.stat(dir);
    assert.equal(st.isDirectory(), true);
    await fs.rm(path.join(process.cwd(), ".bare-repo", projectId), {
      recursive: true,
      force: true
    });
  });

  it("cloneFromBucket creates clone directory", async () => {
    const repo = new CanonicalRepo();
    const projectId = `clone-${Date.now()}`;
    await repo.cloneFromBucket({ projectId, bucket: "b", key: "k" });
    const dir = path.join(process.cwd(), ".bare-repo", `${projectId}-clone`);
    assert.equal((await fs.stat(dir)).isDirectory(), true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("releaseLock is idempotent", async () => {
    const repo = new CanonicalRepo();
    await repo.releaseLock("missing");
  });
});
