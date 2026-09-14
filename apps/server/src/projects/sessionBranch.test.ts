import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { branchSessionFromMessage } from "./sessionBranch.js";
import { recordTouchedFiles } from "./workspaceCheckpoint.js";
import type { ChatTurn, SessionMessage } from "@forge/db";
import type { RestoreEntry } from "./workspaceCheckpoint.js";

const TURN_1 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TURN_2 = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

function message(
  partial: Partial<SessionMessage> & { id: string }
): SessionMessage {
  return {
    sessionId: "s1",
    role: "user",
    parts: [],
    turnId: null,
    deletedAt: null,
    createdAt: new Date(),
    ...partial
  } as SessionMessage;
}

function turn(
  partial: Partial<ChatTurn> & { id: string; sessionId: string }
): ChatTurn {
  return {
    workflowId: `wf-${partial.id}`,
    status: "completed",
    mode: "agent",
    provider: null,
    model: null,
    error: null,
    rounds: 1,
    toolCallCount: 0,
    toolNames: [],
    hitRoundCap: false,
    workspaceCheckpoint: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    ...partial
  } as ChatTurn;
}

describe("sessionBranch", () => {
  let tmp: string;
  let prevRoot: string | undefined;

  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-branch-"));
    prevRoot = process.env.FORGE_SESSIONS_ROOT;
    process.env.FORGE_SESSIONS_ROOT = tmp;
  });

  after(async () => {
    if (prevRoot === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevRoot;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("clones workspace before copying messages and remaps turn ids", async () => {
    const order: string[] = [];
    const copiedTurns: ChatTurn[] = [];
    let turnIdMap: ReadonlyMap<string, string> | undefined;
    const result = await branchSessionFromMessage({
      sourceSessionId: "s1",
      targetSessionId: "s2",
      untilMessageId: "a1",
      live: [
        message({ id: "u1", role: "user", turnId: TURN_1 }),
        message({ id: "a1", role: "assistant", turnId: TURN_1 })
      ],
      cloneWorkspace: async () => {
        order.push("clone");
      },
      turns: {
        getById: async (id: string) =>
          id === TURN_1 ? turn({ id: TURN_1, sessionId: "s1" }) : null,
        listBySessionId: async () => [],
        cloneCompleted: async (input) => {
          order.push("cloneTurn");
          const created = turn({
            id: input.id,
            sessionId: input.sessionId,
            workflowId: input.workflowId
          });
          copiedTurns.push(created);
          return created;
        }
      } as never,
      messages: {
        copyUntil: async (opts) => {
          order.push("copy");
          turnIdMap = opts.turnIdMap;
          return 2;
        }
      } as never
    });
    assert.deepEqual(order, ["clone", "cloneTurn", "copy"]);
    assert.equal(result.copied, 2);
    assert.equal(result.workspaceCloned, true);
    assert.equal(copiedTurns.length, 1);
    assert.equal(turnIdMap?.get(TURN_1), copiedTurns[0]?.id);
    assert.notEqual(copiedTurns[0]?.id, TURN_1);
  });

  it("does not copy messages when workspace clone fails", async () => {
    let copied = false;
    await assert.rejects(
      branchSessionFromMessage({
        sourceSessionId: "s1",
        targetSessionId: "s2",
        untilMessageId: "a1",
        live: [message({ id: "a1", role: "assistant", turnId: TURN_1 })],
        cloneWorkspace: async () => {
          throw new Error("clone failed");
        },
        messages: {
          copyUntil: async () => {
            copied = true;
            return 1;
          }
        } as never
      }),
      /clone failed/
    );
    assert.equal(copied, false);
  });

  it("applies restore-after-turn to the child, not the forked turn itself", async () => {
    const rows = new Map<
      string,
      { id: string; sessionId: string; workspaceCheckpoint: unknown }
    >();
    const turns = {
      getById: async (id: string) => {
        const row = rows.get(id);
        return row ? turn({ id: row.id, sessionId: row.sessionId }) : null;
      },
      setWorkspaceCheckpoint: async (id: string, checkpoint: unknown) => {
        const prev = rows.get(id) ?? {
          id,
          sessionId: "s1",
          workspaceCheckpoint: null
        };
        rows.set(id, { ...prev, workspaceCheckpoint: checkpoint });
        return null;
      },
      listBySessionId: async (sessionId: string) =>
        [...rows.values()].filter((row) => row.sessionId === sessionId),
      cloneCompleted: async (input: { id: string; sessionId: string }) =>
        turn({ id: input.id, sessionId: input.sessionId })
    };
    rows.set(TURN_1, {
      id: TURN_1,
      sessionId: "s1",
      workspaceCheckpoint: null
    });
    rows.set(TURN_2, {
      id: TURN_2,
      sessionId: "s1",
      workspaceCheckpoint: null
    });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_1,
      files: [{ path: "a.ts", op: "update", before: "A0" }],
      turns
    });
    await recordTouchedFiles({
      sessionId: "s1",
      turnId: TURN_2,
      files: [{ path: "b.ts", op: "create", before: null }],
      turns
    });
    let applied: RestoreEntry[] = [];
    await branchSessionFromMessage({
      sourceSessionId: "s1",
      targetSessionId: "s2",
      untilMessageId: "a1",
      live: [
        message({ id: "u1", role: "user", turnId: TURN_1 }),
        message({ id: "a1", role: "assistant", turnId: TURN_1 })
      ],
      cloneWorkspace: async () => undefined,
      restoreWorkspace: async (opts) => {
        applied = opts.plan;
      },
      turns: turns as never,
      messages: { copyUntil: async () => 2 } as never
    });
    const byPath = Object.fromEntries(applied.map((e) => [e.path, e.before]));
    assert.equal(byPath["b.ts"], null);
    assert.equal(byPath["a.ts"], undefined);
  });
});
