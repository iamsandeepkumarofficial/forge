import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensureProjectsRoot,
  ensureSessionsRoot,
  projectCanonicalDir,
  resolveProjectsRoot,
  resolveSessionsRoot,
  sessionWorktreeDir
} from "./projectsRoot.js";

describe("projectsRoot", () => {
  const prevProjects = process.env.FORGE_PROJECTS_ROOT;
  const prevSessions = process.env.FORGE_SESSIONS_ROOT;

  afterEach(() => {
    if (prevProjects === undefined) delete process.env.FORGE_PROJECTS_ROOT;
    else process.env.FORGE_PROJECTS_ROOT = prevProjects;
    if (prevSessions === undefined) delete process.env.FORGE_SESSIONS_ROOT;
    else process.env.FORGE_SESSIONS_ROOT = prevSessions;
  });

  it("defaults under ~/.forge", () => {
    delete process.env.FORGE_PROJECTS_ROOT;
    delete process.env.FORGE_SESSIONS_ROOT;
    assert.equal(
      resolveProjectsRoot(),
      path.join(os.homedir(), ".forge", "projects")
    );
    assert.equal(
      resolveSessionsRoot(),
      path.join(os.homedir(), ".forge", "sessions")
    );
  });

  it("expands ~ and resolves relative env paths", () => {
    process.env.FORGE_PROJECTS_ROOT = "~/forge-projects-test";
    assert.equal(
      resolveProjectsRoot(),
      path.join(os.homedir(), "forge-projects-test")
    );
    process.env.FORGE_SESSIONS_ROOT = "rel-sessions";
    assert.equal(
      resolveSessionsRoot(),
      path.resolve(process.cwd(), "rel-sessions")
    );
  });

  it("builds canonical and worktree paths", () => {
    process.env.FORGE_PROJECTS_ROOT = "/tmp/forge-projects";
    process.env.FORGE_SESSIONS_ROOT = "/tmp/forge-sessions";
    assert.equal(projectCanonicalDir("p1"), "/tmp/forge-projects/p1");
    assert.equal(sessionWorktreeDir("p1", "s1"), "/tmp/forge-sessions/p1/s1");
  });

  it("ensure* creates directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-root-"));
    process.env.FORGE_PROJECTS_ROOT = path.join(root, "projects");
    process.env.FORGE_SESSIONS_ROOT = path.join(root, "sessions");
    const projects = await ensureProjectsRoot();
    const sessions = await ensureSessionsRoot();
    assert.equal(projects, path.join(root, "projects"));
    assert.equal(sessions, path.join(root, "sessions"));
    const st = await fs.stat(projects);
    assert.ok(st.isDirectory());
  });
});
