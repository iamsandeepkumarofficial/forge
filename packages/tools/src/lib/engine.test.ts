import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ToolEngine } from "./engine.js";
import type { ToolContext, ToolDefinition } from "./types.js";

const context = (cwd: string): ToolContext => ({
  cwd,
  sessionId: "sess-1"
});

describe("ToolEngine", () => {
  let tmp: string;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "forge-engine-"));
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("lists registered tools", () => {
    const echo: ToolDefinition = {
      name: "echo",
      description: "Echo",
      parameters: {},
      execute: async (args) => ({
        success: true,
        output: String(args.text ?? "")
      })
    };
    const engine = new ToolEngine([echo]);
    assert.equal(engine.listTools().length, 1);
    assert.equal(engine.listTools()[0]?.name, "echo");
  });

  it("executes a tool and maps thrown errors", async () => {
    const ok: ToolDefinition = {
      name: "ok",
      description: "ok",
      parameters: {},
      execute: async () => ({ success: true, output: "done" })
    };
    const boom: ToolDefinition = {
      name: "boom",
      description: "boom",
      parameters: {},
      execute: async () => {
        throw new Error("explode");
      }
    };
    const engine = new ToolEngine([ok, boom]);
    const good = await engine.execute({
      toolName: "ok",
      args: {},
      context: context(tmp)
    });
    assert.equal(good.success, true);
    assert.equal(good.output, "done");

    const bad = await engine.execute({
      toolName: "boom",
      args: {},
      context: context(tmp)
    });
    assert.equal(bad.success, false);
    assert.equal(bad.output, "explode");
  });

  it("returns failure for unknown tools", async () => {
    const engine = new ToolEngine([]);
    const result = await engine.execute({
      toolName: "missing",
      args: {},
      context: context(tmp)
    });
    assert.equal(result.success, false);
    assert.match(result.output, /Unknown tool/);
  });

  it("detects git worktrees and lists repo dir names", async () => {
    const engine = new ToolEngine([]);
    const repo = path.join(tmp, "app");
    await mkdir(path.join(repo, ".git"), { recursive: true });
    await mkdir(path.join(tmp, "plain"), { recursive: true });
    assert.equal(await engine.isGitWorktreeDir(repo), true);
    assert.equal(await engine.isGitWorktreeDir(path.join(tmp, "plain")), false);
    assert.deepEqual(await engine.listSessionRepoDirNames(tmp), ["app"]);
  });

  it("collects relative files and resolves workspace paths", async () => {
    const engine = new ToolEngine([]);
    await writeFile(path.join(tmp, "readme.md"), "hi\n", "utf8");
    const nested = path.join(tmp, "src");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, "main.ts"), "export {}\n", "utf8");
    const files = await engine.collectRelFiles(tmp);
    assert.ok(files.includes("readme.md"));
    assert.ok(files.includes("src/main.ts"));
    const resolved = await engine.resolveSessionWorkspacePath(
      tmp,
      "src/main.ts"
    );
    assert.equal(resolved.absPath, path.resolve(tmp, "src/main.ts"));
    assert.equal(resolved.displayPath, "src/main.ts");
  });
});
