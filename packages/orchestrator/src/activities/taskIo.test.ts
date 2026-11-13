import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { MAX_INLINE_TASK_OUTPUT_BYTES } from "@forge/core";
import {
  artifactFilePath,
  loadTaskArtifact,
  prepareTaskInput,
  spillTaskOutput
} from "./taskIo.js";

describe("taskIo activities", () => {
  let prevRoot: string | undefined;
  let tmpRoot: string;

  before(async () => {
    prevRoot = process.env.FORGE_SESSIONS_ROOT;
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-artifacts-"));
    process.env.FORGE_SESSIONS_ROOT = tmpRoot;
  });

  after(async () => {
    if (prevRoot === undefined) {
      delete process.env.FORGE_SESSIONS_ROOT;
    } else {
      process.env.FORGE_SESSIONS_ROOT = prevRoot;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("refuses artifact paths that escape the artifact root", () => {
    assert.throws(
      () =>
        artifactFilePath({
          sessionId: "s",
          planId: "p",
          taskId: "..",
          artifactId: "a"
        }),
      /Unsafe taskId/
    );
  });

  it("keeps small outputs inline", async () => {
    const out = await spillTaskOutput({
      sessionId: "s",
      planId: "p",
      taskId: "t",
      value: { ok: true }
    });
    assert.equal(out.kind, "value");
    if (out.kind === "value") {
      assert.deepEqual(out.value, { ok: true });
    }
  });

  it("spills oversized outputs to disk and loads them back", async () => {
    const value = { blob: "x".repeat(MAX_INLINE_TASK_OUTPUT_BYTES + 64) };
    const out = await spillTaskOutput({
      sessionId: "s1",
      planId: "p1",
      taskId: "research",
      value
    });
    assert.equal(out.kind, "artifact");
    if (out.kind !== "artifact") {
      return;
    }
    const filePath = artifactFilePath({
      sessionId: "s1",
      planId: "p1",
      taskId: "research",
      artifactId: out.artifactId
    });
    const raw = await fs.readFile(filePath, "utf8");
    assert.equal(JSON.parse(raw).blob.length, value.blob.length);
    const loaded = await loadTaskArtifact({
      sessionId: "s1",
      planId: "p1",
      taskId: "research",
      artifactId: out.artifactId
    });
    assert.equal(loaded.ok, true);
    if (loaded.ok) {
      assert.equal(
        (loaded.value as { blob: string }).blob.length,
        value.blob.length
      );
    }
  });

  it("prepares fan-in input from dependency values", async () => {
    const prepared = await prepareTaskInput({
      sessionId: "s",
      planId: "p",
      taskId: "b",
      dependencies: [
        { id: "a", output: { kind: "value", value: { summary: "from-a" } } }
      ]
    });
    assert.equal(prepared.ok, true);
    if (prepared.ok) {
      assert.deepEqual(prepared.input, { a: { summary: "from-a" } });
    }
  });

  it("materializes artifact dependencies before mapping", async () => {
    const spilled = await spillTaskOutput({
      sessionId: "s2",
      planId: "p2",
      taskId: "a",
      value: { n: 1, ...{ pad: "y".repeat(MAX_INLINE_TASK_OUTPUT_BYTES) } }
    });
    assert.equal(spilled.kind, "artifact");
    const prepared = await prepareTaskInput({
      sessionId: "s2",
      planId: "p2",
      taskId: "b",
      inputMappings: [{ fromTask: "a", outputPath: "$.n", targetPath: "$.n" }],
      dependencies: [{ id: "a", output: spilled }]
    });
    assert.equal(prepared.ok, true);
    if (prepared.ok) {
      assert.deepEqual(prepared.input, { n: 1 });
    }
  });
});
