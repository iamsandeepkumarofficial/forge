import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("resolveAppLogStreamName", () => {
  let resolveAppLogStreamName: typeof import("./appLogStreamName.js").resolveAppLogStreamName;

  before(async () => {
    mock.module("./appRunner.js", {
      exports: {
        matchLaunchApp: (apps: Array<{ name: string }>, requested: string) => {
          const exact = apps.find((a) => a.name === requested);
          if (exact) return exact;
          return apps.find((a) => a.name.startsWith(`${requested}/`));
        },
        readForgeConfig: async () => ({
          exists: true,
          source: "launch",
          config: { apps: [{ name: "bp-backend/bp-backend" }] }
        })
      }
    });
    ({ resolveAppLogStreamName } = await import("./appLogStreamName.js"));
  });

  it("canonicalizes a short app alias to the launch name", async () => {
    assert.equal(
      await resolveAppLogStreamName("s1", "bp-backend"),
      "bp-backend/bp-backend"
    );
  });

  it("returns the requested name when already canonical", async () => {
    assert.equal(
      await resolveAppLogStreamName("s1", "bp-backend/bp-backend"),
      "bp-backend/bp-backend"
    );
  });
});
