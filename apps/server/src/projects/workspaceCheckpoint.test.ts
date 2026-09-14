import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  copyCheckpointSidecar,
  parseTouchedFileCheckpoint,
  recordTouchedFiles,
  restorePlanAfterTurn,
  restorePlanFromTurn,
  restoreSessionWorkspace,
  sessionCheckpointDir
} from "./workspaceCheckpoint.js";
import type { SessionRepoInfo } from "./sessionSandbox.js";

const TURN_1 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TURN_2 = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

function memoryTurns() {
  const rows = new Map<
    string,
    { id: string; sessionId: string; workspaceCheckpoint: unknown }
  >();
  return {
    seed(row: { id: string; sessionId: string; workspaceCheckpoint: unknown }) {
      rows.set(row.id, row);
    },
    getById: async (id: string) => rows.get(id) ?? null,
    setWorkspaceCheckpoint: async (id: string, checkpoint: unknown) => {
      const prev = rows.get(id) ?? {
        id,
        sessionId: "s1",
        workspaceCheckpoint: null
      };
      rows.set(id, { ...prev, workspaceCheckpoint: checkpoint });
      return rows.get(id);
    },
    listBySessionId: async (sessionId: string) =>
      [...rows.values()].filter((row) => row.sessionId === sessionId)
  };
}

describe("workspaceCheckpoint", () => {
  let tmp: string;
  let prevRoot: string | undefined;

  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-ckpt-"));
    prevRoot = process.env.FORGE_SESSIONS_ROOT;
    process.env.FORGE_SESSIONS_ROOT = tmp;
  });

  after(async () => {
    if (prevRoot === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevRoot;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("ignores legacy repo-to-sha maps", () => {
    assert.equal(
      parseTouchedFileCheckpoint({
        portfolio: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }),
      null
    );
    assert.equal(parseTouchedFileCheckpoint(null), null);
    assert.deepEqual(
      parseTouchedFileCheckpoint({
        version: 1,
        files: [{ path: "a.ts", op: "update", blob: "a".repeat(64) }]
      }),
      {
        version: 1,
        files: [{ path: "a.ts", op: "update", blob: "a".repeat(64) }]
      }
    );
  });

  it("records first touch of a path and keeps that before across later edits", async () => {
    const turns = memoryTurns();
    turns.seed({
      id: TURN_1,
      sessionId: "s1",
      workspaceCheckpoint: null
    });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "app.ts", op: "update", before: "v1\n" }],
      turns
    });
    const second = await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "app.ts", op: "update", before: "v2\n" }],
      turns
    });
    assert.equal(second.files.length, 1);
    assert.equal(second.files[0]?.op, "update");
    const plan = await restorePlanFromTurn({
      sessionId: "s1",
      turnId: TURN_1,
      turns
    });
    assert.deepEqual(plan, [{ path: "app.ts", before: "v1\n" }]);
    const meta = await fs.readFile(
      path.join(sessionCheckpointDir("s1", TURN_1), "metadata.json"),
      "utf8"
    );
    assert.match(meta, /app\.ts/);
  });

  it("restore plan uses the earliest before across later turns", async () => {
    const turns = memoryTurns();
    turns.seed({ id: TURN_1, sessionId: "s1", workspaceCheckpoint: null });
    turns.seed({ id: TURN_2, sessionId: "s1", workspaceCheckpoint: null });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "a.ts", op: "update", before: "A0" }],
      turns
    });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_2,
      files: [
        { path: "a.ts", op: "update", before: "A1" },
        { path: "b.ts", op: "create", before: null }
      ],
      turns
    });
    const plan = await restorePlanFromTurn({
      sessionId: "s1",
      turnId: TURN_1,
      turns
    });
    const byPath = Object.fromEntries(plan.map((e) => [e.path, e.before]));
    assert.equal(byPath["a.ts"], "A0");
    assert.equal(byPath["b.ts"], null);
  });

  it("restore plan after a turn excludes that turn's own touches", async () => {
    const turns = memoryTurns();
    turns.seed({ id: TURN_1, sessionId: "s1", workspaceCheckpoint: null });
    turns.seed({ id: TURN_2, sessionId: "s1", workspaceCheckpoint: null });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "a.ts", op: "update", before: "A0" }],
      turns
    });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_2,
      files: [
        { path: "a.ts", op: "update", before: "A1" },
        { path: "b.ts", op: "create", before: null }
      ],
      turns
    });
    const plan = await restorePlanAfterTurn({
      sessionId: "s1",
      turnId: TURN_1,
      turns
    });
    const byPath = Object.fromEntries(plan.map((e) => [e.path, e.before]));
    assert.equal(byPath["a.ts"], "A1");
    assert.equal(byPath["b.ts"], null);
    assert.equal(
      (
        await restorePlanAfterTurn({
          sessionId: "s1",
          turnId: TURN_2,
          turns
        })
      ).length,
      0
    );
  });

  it("copies a checkpoint sidecar to a new session and turn id", async () => {
    const turns = memoryTurns();
    turns.seed({ id: TURN_1, sessionId: "s1", workspaceCheckpoint: null });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "app.ts", op: "update", before: "keep\n" }],
      turns
    });
    await copyCheckpointSidecar({
      sourceSessionId: "s1",
      sourceTurnId: TURN_1,
      targetSessionId: "s2",
      targetTurnId: TURN_2
    });
    const copied = await fs.readFile(
      path.join(sessionCheckpointDir("s2", TURN_2), "metadata.json"),
      "utf8"
    );
    assert.match(copied, /app.ts/);
  });

  it("writes earliest before bytes and unlinks created files on host restore", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-restore-"));
    try {
      await fs.writeFile(path.join(dir, "a.ts"), "A1", "utf8");
      await fs.writeFile(path.join(dir, "b.ts"), "new", "utf8");
      const info: SessionRepoInfo = {
        containerName: dir,
        repoDir: "repo",
        workingDir: "/workspace",
        sessionRoot: "/workspace",
        hostWorkingDir: dir
      };
      await restoreSessionWorkspace({
        sessionId: "s1",
        plan: [
          { path: "a.ts", before: "A0" },
          { path: "b.ts", before: null }
        ],
        info,
        host: true
      });
      assert.equal(await fs.readFile(path.join(dir, "a.ts"), "utf8"), "A0");
      await assert.rejects(fs.stat(path.join(dir, "b.ts")), /ENOENT/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
