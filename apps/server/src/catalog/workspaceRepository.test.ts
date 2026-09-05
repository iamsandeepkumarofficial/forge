import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function thenable(value: unknown) {
  return {
    then(
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    }
  };
}

function chain(finalValue: unknown) {
  const api: Record<string, unknown> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("WorkspaceRepository", () => {
  let WorkspaceRepository: typeof import("./workspaceRepository.js").WorkspaceRepository;
  let selectRows: unknown[] = [];
  let created = {
    id: "ws1",
    userId: "u1",
    name: "Demo",
    routes: [] as unknown[]
  };
  let updated: unknown = null;

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([created]),
          select: () => chain(selectRows),
          delete: () => chain(undefined),
          update: () => {
            updated = true;
            return chain([created]);
          }
        }),
        workspaces: {
          id: "id",
          userId: "userId",
          name: "name",
          routes: "routes",
          createdAt: "createdAt",
          lastActivityAt: "lastActivityAt"
        },
        workspaceProjects: {
          id: "id",
          workspaceId: "workspaceId",
          projectId: "projectId",
          repoName: "repoName",
          sortOrder: "sortOrder",
          dependsOn: "dependsOn",
          env: "env",
          createdAt: "createdAt"
        }
      }
    });
    ({ WorkspaceRepository } = await import("./workspaceRepository.js"));
  });

  it("create returns inserted workspace", async () => {
    const repo = new WorkspaceRepository();
    const row = await repo.create({ userId: "u1", name: "Demo" });
    assert.equal(row.id, "ws1");
  });

  it("getById returns null or row", async () => {
    selectRows = [];
    const repo = new WorkspaceRepository();
    assert.equal(await repo.getById("missing"), null);
    selectRows = [created];
    assert.equal((await repo.getById("ws1"))?.name, "Demo");
  });

  it("list/update/delete and member helpers run", async () => {
    selectRows = [created];
    updated = null;
    const repo = new WorkspaceRepository();
    assert.equal((await repo.listByUserId("u1")).length, 1);
    await repo.updateLastActivity("ws1");
    await repo.updateName("ws1", "Renamed");
    await repo.updateRoutes("ws1", [{ path: "/", target: "web" } as never]);
    await repo.delete("ws1");

    selectRows = [
      {
        workspaceId: "ws1",
        projectId: "p1",
        repoName: "api",
        sortOrder: 0,
        dependsOn: []
      }
    ];
    assert.equal((await repo.listMembers("ws1")).length, 1);
    assert.equal((await repo.getMember("ws1", "p1"))?.repoName, "api");
    assert.equal(
      (await repo.findMemberByRepoName("ws1", "api"))?.projectId,
      "p1"
    );
    created = {
      id: "m1",
      userId: "u1",
      name: "m",
      routes: []
    } as never;
    await repo.addMember({
      workspaceId: "ws1",
      projectId: "p2",
      repoName: "web",
      sortOrder: 1,
      dependsOn: ["api"],
      env: {}
    });
    await repo.updateMember({
      workspaceId: "ws1",
      projectId: "p1",
      patch: { sortOrder: 2 }
    });
    await repo.removeMember("ws1", "p1");
    assert.equal(updated, true);
  });
});
