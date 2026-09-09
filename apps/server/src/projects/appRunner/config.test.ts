import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferWorkspaceRepo, matchLaunchApp } from "./config.js";

describe("appRunner config", () => {
  it("inferWorkspaceRepo resolves from cwd and name prefixes", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "api/src", repo: undefined },
        memberRepos: ["api", "web"]
      }),
      "api"
    );
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web/app", cwd: ".", repo: undefined },
        memberRepos: ["api", "web"]
      }),
      "web"
    );
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "x", cwd: ".", repo: "api" },
        memberRepos: ["api", "web"]
      }),
      "api"
    );
  });

  it("matchLaunchApp accepts repo alias for qualified workspace names", () => {
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
