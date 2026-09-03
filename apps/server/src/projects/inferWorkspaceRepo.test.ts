import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferWorkspaceRepo } from "./appRunner.js";

describe("inferWorkspaceRepo", () => {
  const members = ["bp-frontend", "bp-backend"];

  it("uses explicit repo when valid", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: ".", repo: "bp-backend" },
        memberRepos: members
      }),
      "bp-backend"
    );
  });

  it("infers from cwd first segment", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "bp-frontend" },
        memberRepos: members
      }),
      "bp-frontend"
    );
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "bp-frontend/apps/web" },
        memberRepos: members
      }),
      "bp-frontend"
    );
  });

  it("infers from name prefix", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "bp-backend/api", cwd: "." },
        memberRepos: members
      }),
      "bp-backend"
    );
  });

  it("returns null when ambiguous", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "." },
        memberRepos: members
      }),
      null
    );
  });

  it("defaults to the only member", () => {
    assert.equal(
      inferWorkspaceRepo({
        app: { name: "web", cwd: "." },
        memberRepos: ["bp-frontend"]
      }),
      "bp-frontend"
    );
  });
});
