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
    "limit",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete",
    "onConflictDoUpdate"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("WorkspaceEnvironmentRepository", () => {
  let WorkspaceEnvironmentRepository: typeof import("./workspaceEnvironmentRepository.js").WorkspaceEnvironmentRepository;
  let selectRows: unknown[] = [];
  let lastUpsert: unknown = null;
  let deleted = false;

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          select: () => chain(selectRows),
          insert: () => {
            const c = chain(undefined);
            const origValues = c.values as () => typeof c;
            c.values = (v: unknown) => {
              lastUpsert = v;
              return origValues();
            };
            return c;
          },
          delete: () => {
            deleted = true;
            return chain(undefined);
          }
        }),
        workspaceEnvironments: {
          workspaceId: "workspaceId",
          launch: "launch",
          sourceSessionId: "sourceSessionId",
          updatedAt: "updatedAt"
        }
      }
    });
    ({ WorkspaceEnvironmentRepository } =
      await import("./workspaceEnvironmentRepository.js"));
  });

  it("get returns null when missing", async () => {
    selectRows = [];
    const repo = new WorkspaceEnvironmentRepository();
    assert.equal(await repo.get("ws1"), null);
  });

  it("get normalizes launch.apps", async () => {
    selectRows = [
      {
        workspaceId: "ws1",
        launch: { apps: [{ name: "web" }] },
        sourceSessionId: "s1",
        updatedAt: new Date("2026-01-01")
      }
    ];
    const repo = new WorkspaceEnvironmentRepository();
    const row = await repo.get("ws1");
    assert.equal(row?.workspaceId, "ws1");
    assert.deepEqual(row?.launch.apps, [{ name: "web" }]);

    selectRows = [
      {
        workspaceId: "ws1",
        launch: null,
        sourceSessionId: null,
        updatedAt: new Date()
      }
    ];
    const empty = await repo.get("ws1");
    assert.deepEqual(empty?.launch, { apps: [] });
  });

  it("upsertLaunch and clearLaunch call db", async () => {
    deleted = false;
    lastUpsert = null;
    const repo = new WorkspaceEnvironmentRepository();
    await repo.upsertLaunch({
      workspaceId: "ws1",
      launch: { apps: [{ name: "a" }] },
      sourceSessionId: "s1"
    });
    assert.ok(lastUpsert);
    await repo.clearLaunch("ws1");
    assert.equal(deleted, true);
  });
});
