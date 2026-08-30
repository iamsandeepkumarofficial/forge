import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { ensureWebUi } from "./webUi.js";

describe("ensureWebUi", () => {
  it("returns null when the UI is already up", async () => {
    const child = await ensureWebUi({
      root: "/tmp",
      check: async () => true,
      spawn: () => {
        throw new Error("should not spawn");
      }
    });
    assert.equal(child, null);
  });

  it("spawns vite when the UI is down", async () => {
    const fake = new EventEmitter() as ReturnType<
      NonNullable<Parameters<typeof ensureWebUi>[0]["spawn"]>
    >;
    let spawned = "";
    const child = await ensureWebUi({
      root: "/repo",
      check: async () => false,
      spawn: (root) => {
        spawned = root;
        return fake;
      }
    });
    assert.equal(spawned, "/repo");
    assert.equal(child, fake);
  });
});
