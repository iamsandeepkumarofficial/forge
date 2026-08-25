import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  DEFAULT_WORKFLOW_ID,
  assertSafeDefinitionId,
  deleteUserWorkflow,
  listSystemWorkflowIds,
  listWorkflowCatalog,
  resolveWorkflow,
  serializePipeline,
  userWorkflowsRoot,
  writeUserWorkflow,
  writeUserWorkflowDefinition
} from "./resolve.js";
import type { PipelineDefinition } from "./types.js";

const samplePipeline = (): PipelineDefinition => ({
  name: "custom",
  version: 1,
  finalColumn: "done",
  stages: [
    {
      id: "build",
      agent: "code-generation",
      column: "development",
      action: "implement",
      commentTitle: "Build",
      gate: "auto"
    }
  ]
});

describe("resolve workflows", () => {
  let tmpRoot: string;
  let previousRoot: string | undefined;

  before(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "forge-workflows-"));
    previousRoot = process.env.FORGE_USER_WORKFLOWS_ROOT;
    process.env.FORGE_USER_WORKFLOWS_ROOT = tmpRoot;
  });

  after(async () => {
    if (previousRoot === undefined) {
      delete process.env.FORGE_USER_WORKFLOWS_ROOT;
    } else {
      process.env.FORGE_USER_WORKFLOWS_ROOT = previousRoot;
    }
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("userWorkflowsRoot respects FORGE_USER_WORKFLOWS_ROOT", () => {
    assert.equal(userWorkflowsRoot(), tmpRoot);
  });

  it("resolves the default system sdlc workflow", async () => {
    const ids = await listSystemWorkflowIds();
    assert.ok(ids.includes(DEFAULT_WORKFLOW_ID));
    const resolved = await resolveWorkflow({});
    assert.equal(resolved.id, DEFAULT_WORKFLOW_ID);
    assert.equal(resolved.source, "system");
    assert.equal(resolved.definition.name, "sdlc");
    assert.ok(resolved.definition.stages.length > 0);
  });

  it("writes user workflows that override system by id", async () => {
    const yaml = serializePipeline({
      ...samplePipeline(),
      name: "user-sdlc"
    });
    await writeUserWorkflow({
      userId: "u1",
      id: DEFAULT_WORKFLOW_ID,
      yamlText: yaml
    });
    const resolved = await resolveWorkflow({
      id: DEFAULT_WORKFLOW_ID,
      userId: "u1"
    });
    assert.equal(resolved.source, "user");
    assert.equal(resolved.definition.name, "user-sdlc");
  });

  it("catalogs, writes definitions, and deletes user workflows", async () => {
    const written = await writeUserWorkflowDefinition({
      userId: "u2",
      id: "fast-track",
      definition: samplePipeline()
    });
    assert.equal(written.id, "fast-track");
    assert.equal(written.source, "user");

    const catalog = await listWorkflowCatalog("u2");
    const entry = catalog.find((e) => e.id === "fast-track");
    assert.ok(entry);
    assert.equal(entry?.stageCount, 1);
    assert.equal(entry?.source, "user");

    await deleteUserWorkflow("u2", "fast-track");
    await assert.rejects(
      () => deleteUserWorkflow("u2", "fast-track"),
      /not found/
    );
  });

  it("rejects unsafe ids and missing workflows", async () => {
    assert.throws(() => assertSafeDefinitionId("bad/id"), /Invalid id/);
    await assert.rejects(
      () => resolveWorkflow({ id: "missing-workflow-xyz" }),
      /not found/
    );
  });
});
