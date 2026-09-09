import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchLaunchApp } from "./matchLaunchApp.js";

describe("matchLaunchApp", () => {
  it("accepts repo alias for qualified workspace names", () => {
    const apps = [
      {
        name: "bp-backend/bp-backend",
        cwd: "bp-backend",
        command: "npm run start",
        type: "api" as const,
        repo: "bp-backend",
        port: 3000
      },
      {
        name: "bp-frontend/bp-frontend",
        cwd: "bp-frontend",
        command: "npm run dev",
        type: "web" as const,
        repo: "bp-frontend",
        port: 3001
      }
    ];
    assert.equal(
      matchLaunchApp(apps, "bp-backend")?.name,
      "bp-backend/bp-backend"
    );
    assert.equal(
      matchLaunchApp(apps, "bp-backend/bp-backend")?.name,
      "bp-backend/bp-backend"
    );
    assert.equal(matchLaunchApp(apps, "missing"), undefined);
  });
});
