import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  backfillOrphanProjects,
  ensureWorkspaceForProject,
  findPrimaryWorkspaceIdForProject,
  wrapProjectInNewWorkspace,
  type WorkspaceConnectHost
} from "./workspaceConnect.js";

function hostStub(
  overrides: Partial<WorkspaceConnectHost> = {}
): WorkspaceConnectHost {
  return {
    projectRepo: {
      getById: async () => ({
        id: "p1",
        userId: "u1",
        name: "demo",
        source: "local",
        dedupeKey: "local:/tmp/demo",
        status: "available",
        canonicalKey: null,
        createdAt: new Date(),
        lastActivityAt: new Date()
      }),
      listByUserId: async () => []
    } as never,
    workspaceRepo: {
      listMembershipsByProjectId: async () => []
    } as never,
    createWorkspace: async () => ({ id: "w1" }),
    addProject: async () => ({}),
    ...overrides
  };
}

describe("workspaceConnect", () => {
  it("wrapProjectInNewWorkspace creates workspace and adds member", async () => {
    const addProject = mock.fn(async () => ({}));
    const createWorkspace = mock.fn(async () => ({ id: "w-new" }));
    const result = await wrapProjectInNewWorkspace(
      hostStub({ createWorkspace, addProject }),
      { userId: "u1", projectId: "p1", workspaceName: "demo" }
    );
    assert.equal(result.workspaceId, "w-new");
    assert.equal(createWorkspace.mock.callCount(), 1);
    assert.equal(addProject.mock.callCount(), 1);
  });

  it("ensureWorkspaceForProject reuses existing membership", async () => {
    const createWorkspace = mock.fn(async () => ({ id: "w-new" }));
    const result = await ensureWorkspaceForProject(
      hostStub({
        createWorkspace,
        workspaceRepo: {
          listMembershipsByProjectId: async () => [
            { workspaceId: "w-existing", projectId: "p1" }
          ]
        } as never
      }),
      { userId: "u1", projectId: "p1" }
    );
    assert.equal(result.workspaceId, "w-existing");
    assert.equal(createWorkspace.mock.callCount(), 0);
  });

  it("findPrimaryWorkspaceIdForProject returns null when empty", async () => {
    const id = await findPrimaryWorkspaceIdForProject(hostStub(), "p1");
    assert.equal(id, null);
  });

  it("backfillOrphanProjects wraps projects without membership", async () => {
    const createWorkspace = mock.fn(async () => ({ id: "w-bf" }));
    const created = await backfillOrphanProjects(
      hostStub({
        createWorkspace,
        projectRepo: {
          getById: async () => ({
            id: "p2",
            userId: "u1",
            name: "orphan",
            source: "local",
            dedupeKey: "local:/tmp/o",
            status: "available",
            canonicalKey: null,
            createdAt: new Date(),
            lastActivityAt: new Date()
          }),
          listByUserId: async () => [
            {
              id: "p2",
              userId: "u1",
              name: "orphan",
              source: "local",
              dedupeKey: "local:/tmp/o",
              status: "available",
              canonicalKey: null,
              createdAt: new Date(),
              lastActivityAt: new Date()
            }
          ]
        } as never
      }),
      "u1"
    );
    assert.equal(created, 1);
    assert.equal(createWorkspace.mock.callCount(), 1);
  });
});
