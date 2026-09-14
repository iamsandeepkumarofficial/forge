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
    "delete",
    "onConflictDoNothing",
    "onConflictDoUpdate"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("WorkspaceDatabaseRepository", () => {
  let WorkspaceDatabaseRepository: typeof import("./workspaceDatabaseRepository.js").WorkspaceDatabaseRepository;
  let selectRows: unknown[] = [];
  let inserted: unknown = null;

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          select: () => chain(selectRows),
          insert: () => {
            const c = chain([inserted]);
            return c;
          },
          delete: () => chain(undefined)
        }),
        workspaceDatabases: {
          workspaceId: "workspaceId",
          engineId: "engineId",
          databaseName: "databaseName"
        }
      }
    });
    ({ WorkspaceDatabaseRepository } =
      await import("./workspaceDatabaseRepository.js"));
  });

  it("list returns rows for workspace", async () => {
    selectRows = [{ workspaceId: "ws1", engineId: "postgres" }];
    const repo = new WorkspaceDatabaseRepository();
    assert.equal((await repo.list("ws1")).length, 1);
  });

  it("attach returns existing row without insert", async () => {
    selectRows = [
      { workspaceId: "ws1", engineId: "postgres", databaseName: "db" }
    ];
    inserted = null;
    const repo = new WorkspaceDatabaseRepository();
    const row = await repo.attach({
      workspaceId: "ws1",
      engineId: "postgres",
      databaseName: "db"
    });
    assert.equal(row.databaseName, "db");
  });

  it("attach inserts when absent", async () => {
    selectRows = [];
    inserted = {
      workspaceId: "ws1",
      engineId: "mongo",
      databaseName: "db2"
    };
    const repo = new WorkspaceDatabaseRepository();
    const row = await repo.attach({
      workspaceId: "ws1",
      engineId: "mongo",
      databaseName: "db2"
    });
    assert.equal(row.engineId, "mongo");
  });

  it("detach runs delete", async () => {
    const repo = new WorkspaceDatabaseRepository();
    await repo.detach("ws1", "postgres");
  });
});
