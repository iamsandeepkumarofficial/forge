import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("WorkspaceService", () => {
  let WorkspaceService: typeof import("./workspace.service.js").WorkspaceService;
  const scheduled: string[] = [];

  const workspace = {
    id: "ws1",
    userId: "u1",
    name: "Demo",
    routes: [] as Array<{ path: string; target: string }>,
    createdAt: new Date(),
    lastActivityAt: new Date()
  };
  let members: Array<{
    workspaceId: string;
    projectId: string;
    repoName: string;
    sortOrder: number;
    dependsOn: string[];
    env: Record<string, string>;
  }> = [];
  const projects: Record<
    string,
    {
      id: string;
      userId: string;
      name: string;
      source: string;
      dedupeKey: string;
    }
  > = {
    p1: {
      id: "p1",
      userId: "u1",
      name: "API",
      source: "github",
      dedupeKey: "org/api-service"
    },
    p2: {
      id: "p2",
      userId: "u1",
      name: "Web",
      source: "local",
      dedupeKey: "web"
    },
    other: {
      id: "other",
      userId: "u2",
      name: "Other",
      source: "github",
      dedupeKey: "org/other"
    }
  };

  before(async () => {
    mock.module("./workspaceHealthJob.js", {
      exports: {
        scheduleWorkspaceHealthAnalysis: (id: string) => {
          scheduled.push(id);
        }
      }
    });
    mock.module("../../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async create(input: { userId: string; name: string }) {
            return { ...workspace, ...input, id: "ws-new", routes: [] };
          }
          async listByUserId() {
            return [workspace];
          }
          async getById(id: string) {
            return id === workspace.id || id === "ws-new"
              ? { ...workspace, id }
              : null;
          }
          async delete() {}
          async updateLastActivity() {}
          async updateName(id: string, name: string) {
            workspace.name = name;
            return { ...workspace, id, name };
          }
          async updateRoutes(id: string, routes: typeof workspace.routes) {
            workspace.routes = routes;
            return { ...workspace, id, routes };
          }
          async listMembers() {
            return members;
          }
          async getMember(_ws: string, projectId: string) {
            return members.find((m) => m.projectId === projectId) ?? null;
          }
          async findMemberByRepoName(_ws: string, repoName: string) {
            return members.find((m) => m.repoName === repoName) ?? null;
          }
          async addMember(input: (typeof members)[number]) {
            members.push(input);
            return input;
          }
          async removeMember(_ws: string, projectId: string) {
            members = members.filter((m) => m.projectId !== projectId);
          }
          async updateMember(options: {
            workspaceId: string;
            projectId: string;
            patch: Partial<(typeof members)[number]>;
          }) {
            const m = members.find((x) => x.projectId === options.projectId);
            if (!m) return null;
            Object.assign(m, options.patch);
            return m;
          }
        }
      }
    });
    mock.module("../../catalog/projectRepository.js", {
      exports: {
        ProjectRepository: class {
          async getById(id: string) {
            return projects[id] ?? null;
          }
        }
      }
    });
    ({ WorkspaceService } = await import("./workspace.service.js"));
  });

  it("createWorkspace requires name and schedules health", async () => {
    scheduled.length = 0;
    const svc = new WorkspaceService();
    await assert.rejects(
      () => svc.createWorkspace("u1", "  "),
      (err: Error & { status?: number }) => err.status === 400
    );
    const ws = await svc.createWorkspace("u1", "  My WS ");
    assert.equal(ws.name, "My WS");
    assert.deepEqual(ws.members, []);
    assert.ok(scheduled.includes("ws-new"));
  });

  it("enforces ownership on get/delete", async () => {
    const svc = new WorkspaceService();
    await assert.rejects(
      () => svc.getWorkspaceDetail("ws1", "u2"),
      (err: Error & { status?: number }) => err.status === 403
    );
    await assert.rejects(
      () => svc.getWorkspaceDetail("missing", "u1"),
      (err: Error & { status?: number }) => err.status === 404
    );
    await svc.deleteWorkspace("ws1", "u1");
  });

  it("addProject validates ownership, duplicates, and default repoName", async () => {
    members = [];
    workspace.routes = [];
    workspace.name = "Demo";
    const svc = new WorkspaceService();

    await assert.rejects(
      () =>
        svc.addProject({
          workspaceId: "ws1",
          userId: "u1",
          input: { projectId: "missing" }
        }),
      (err: Error & { status?: number }) => err.status === 404
    );
    await assert.rejects(
      () =>
        svc.addProject({
          workspaceId: "ws1",
          userId: "u1",
          input: { projectId: "other" }
        }),
      (err: Error & { status?: number }) => err.status === 403
    );

    const detail = await svc.addProject({
      workspaceId: "ws1",
      userId: "u1",
      input: { projectId: "p1" }
    });
    assert.equal(detail.members[0]!.repoName, "api-service");
    assert.equal(members.length, 1);

    await assert.rejects(
      () =>
        svc.addProject({
          workspaceId: "ws1",
          userId: "u1",
          input: { projectId: "p1" }
        }),
      (err: Error & { status?: number }) => err.status === 409
    );
  });

  it("removeProject cleans dependsOn and routes", async () => {
    members = [
      {
        workspaceId: "ws1",
        projectId: "p1",
        repoName: "api",
        sortOrder: 0,
        dependsOn: [],
        env: {}
      },
      {
        workspaceId: "ws1",
        projectId: "p2",
        repoName: "web",
        sortOrder: 1,
        dependsOn: ["api"],
        env: {}
      }
    ];
    workspace.routes = [
      { path: "/api", target: "api" },
      { path: "/", target: "web" }
    ];
    const svc = new WorkspaceService();
    const detail = await svc.removeProject({
      workspaceId: "ws1",
      userId: "u1",
      projectId: "p1"
    });
    assert.equal(detail.members.length, 1);
    assert.deepEqual(members[0]!.dependsOn, []);
    assert.deepEqual(workspace.routes, [{ path: "/", target: "web" }]);
  });

  it("updateMember rejects self-depends and cycles", async () => {
    members = [
      {
        workspaceId: "ws1",
        projectId: "p1",
        repoName: "api",
        sortOrder: 0,
        dependsOn: [],
        env: {}
      },
      {
        workspaceId: "ws1",
        projectId: "p2",
        repoName: "web",
        sortOrder: 1,
        dependsOn: [],
        env: {}
      }
    ];
    const svc = new WorkspaceService();
    await assert.rejects(
      () =>
        svc.updateMember({
          workspaceId: "ws1",
          userId: "u1",
          projectId: "p1",
          patch: { dependsOn: ["api"] }
        }),
      (err: Error & { status?: number }) =>
        err.status === 400 && /itself/.test(err.message)
    );
    await svc.updateMember({
      workspaceId: "ws1",
      userId: "u1",
      projectId: "p2",
      patch: { dependsOn: ["api"] }
    });
    await assert.rejects(
      () =>
        svc.updateMember({
          workspaceId: "ws1",
          userId: "u1",
          projectId: "p1",
          patch: { dependsOn: ["web"] }
        }),
      (err: Error & { status?: number }) =>
        err.status === 400 && /cycle/.test(err.message)
    );
  });
});
