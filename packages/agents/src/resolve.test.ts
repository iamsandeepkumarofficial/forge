import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  assertSafeAgentId,
  deleteUserAgent,
  listAgentCatalog,
  listSystemAgentIds,
  resolveAgent,
  serializeAgent,
  userAgentsRoot,
  writeUserAgent,
  writeUserAgentDefinition
} from "./resolve.js";
import type { AgentDefinition } from "./types.js";

const sampleDefinition = (id: string): AgentDefinition => ({
  id,
  name: `Agent ${id}`,
  description: `Description for ${id}`,
  tools: ["read_file"],
  skills: [],
  systemPrompt: `Prompt for ${id}`
});

describe("resolve agents", () => {
  let tmpRoot: string;
  let previousRoot: string | undefined;

  before(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "forges-"));
    previousRoot = process.env.FORGE_USER_AGENTS_ROOT;
    process.env.FORGE_USER_AGENTS_ROOT = tmpRoot;
  });

  after(async () => {
    if (previousRoot === undefined) {
      delete process.env.FORGE_USER_AGENTS_ROOT;
    } else {
      process.env.FORGE_USER_AGENTS_ROOT = previousRoot;
    }
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("userAgentsRoot respects FORGE_USER_AGENTS_ROOT", () => {
    assert.equal(userAgentsRoot(), tmpRoot);
  });

  it("lists and resolves system agents", async () => {
    const ids = await listSystemAgentIds();
    assert.ok(ids.includes("code-review"));
    const resolved = await resolveAgent({ id: "code-review" });
    assert.equal(resolved.source, "system");
    assert.equal(resolved.definition.id, "code-review");
    assert.ok(resolved.path.endsWith("code-review.yaml"));
  });

  it("prefers user agents over system when userId is set", async () => {
    const id = "code-review";
    const yaml = serializeAgent({
      ...sampleDefinition(id),
      name: "User Override Review"
    });
    await writeUserAgent({ userId: "u1", id, yamlText: yaml });
    const resolved = await resolveAgent({ id, userId: "u1" });
    assert.equal(resolved.source, "user");
    assert.equal(resolved.definition.name, "User Override Review");
  });

  it("writes, catalogs, and deletes user agents", async () => {
    const def = sampleDefinition("custom-helper");
    const written = await writeUserAgentDefinition({
      userId: "u2",
      definition: def
    });
    assert.equal(written.source, "user");
    assert.ok(written.path.includes(path.join("u2", "custom-helper.yaml")));

    const catalog = await listAgentCatalog("u2");
    const entry = catalog.find((e) => e.id === "custom-helper");
    assert.ok(entry);
    assert.equal(entry?.source, "user");

    await deleteUserAgent("u2", "custom-helper");
    await assert.rejects(
      () => deleteUserAgent("u2", "custom-helper"),
      /not found/
    );
  });

  it("rejects unsafe ids and yaml/path id mismatch", async () => {
    assert.throws(() => assertSafeAgentId("../evil"), /Invalid id/);
    await assert.rejects(
      () =>
        writeUserAgent({
          userId: "u3",
          id: "path-id",
          yamlText: serializeAgent(sampleDefinition("other-id"))
        }),
      /must match path id/
    );
  });

  it("throws when agent id is missing", async () => {
    await assert.rejects(
      () => resolveAgent({ id: "does-not-exist-xyz" }),
      /not found/
    );
  });
});
