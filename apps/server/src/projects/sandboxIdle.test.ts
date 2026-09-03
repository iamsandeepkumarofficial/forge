import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SANDBOX_IDLE_MS,
  isPastIdleTtl,
  laterActivity,
  suspendIdleSandboxes
} from "./sandboxIdle.js";

describe("sandboxIdle", () => {
  it("treats 30 minutes without activity as idle", () => {
    const now = Date.parse("2026-08-30T18:00:00Z");
    assert.equal(
      isPastIdleTtl(new Date("2026-08-30T17:30:01Z"), now, SANDBOX_IDLE_MS),
      false
    );
    assert.equal(
      isPastIdleTtl(new Date("2026-08-30T17:30:00Z"), now, SANDBOX_IDLE_MS),
      true
    );
  });

  it("stops containers with no running agent past the idle ttl", async () => {
    const stopped: string[] = [];
    const result = await suspendIdleSandboxes({
      now: () => Date.parse("2026-08-30T18:00:00Z"),
      idleMs: SANDBOX_IDLE_MS,
      listRunning: async () => ["active", "idle", "working"],
      listAgentSessions: async () => ["working"],
      getLastActivity: async (sessionId) => {
        if (sessionId === "idle") return new Date("2026-08-30T17:00:00Z");
        if (sessionId === "active") return new Date("2026-08-30T17:45:00Z");
        return new Date("2026-08-30T12:00:00Z");
      },
      suspend: async (sessionId) => {
        stopped.push(sessionId);
      }
    });
    assert.deepEqual(result, ["idle"]);
    assert.deepEqual(stopped, ["idle"]);
  });

  it("does not stop a sandbox that was just started even if chat activity is stale", async () => {
    const stopped: string[] = [];
    const result = await suspendIdleSandboxes({
      now: () => Date.parse("2026-08-30T18:00:00Z"),
      idleMs: SANDBOX_IDLE_MS,
      listRunning: async () => ["reopened"],
      listAgentSessions: async () => [],
      getLastActivity: async () => new Date("2026-08-30T12:00:00Z"),
      getStartedAt: async () => new Date("2026-08-30T17:59:00Z"),
      suspend: async (sessionId) => {
        stopped.push(sessionId);
      }
    });
    assert.deepEqual(result, []);
    assert.deepEqual(stopped, []);
  });

  it("laterActivity prefers the more recent timestamp", () => {
    assert.equal(
      laterActivity(new Date("2026-08-30T12:00:00Z"), Date.parse("2026-08-30T18:00:00Z")),
      Date.parse("2026-08-30T18:00:00Z")
    );
    assert.equal(laterActivity(null, null), null);
  });

  it("skips unknown sessions and those with a running agent", async () => {
    const stopped: string[] = [];
    const result = await suspendIdleSandboxes({
      now: () => Date.parse("2026-08-30T18:00:00Z"),
      idleMs: SANDBOX_IDLE_MS,
      listRunning: async () => ["ghost", "busy"],
      listAgentSessions: async () => ["busy"],
      getLastActivity: async () => null,
      suspend: async (sessionId) => {
        stopped.push(sessionId);
      }
    });
    assert.deepEqual(result, []);
    assert.deepEqual(stopped, []);
  });
});
