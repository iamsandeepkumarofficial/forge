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
    "delete"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("ParameterRepository", () => {
  let ParameterRepository: typeof import("./parameterRepository.js").ParameterRepository;
  let selectRows: unknown[] = [];
  let lastUpdate: unknown = null;
  let lastInsert: unknown = null;

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          select: () => chain(selectRows),
          insert: () => {
            const c = chain([
              {
                id: "new",
                key: "K",
                value: "v",
                secret: false
              }
            ]);
            const origValues = c.values as () => typeof c;
            c.values = (v: unknown) => {
              lastInsert = v;
              return origValues();
            };
            return c;
          },
          update: () => {
            const c = chain([
              {
                id: "ex",
                key: "K",
                value: "updated",
                secret: true
              }
            ]);
            const origSet = c.set as () => typeof c;
            c.set = (v: unknown) => {
              lastUpdate = v;
              return origSet();
            };
            return c;
          },
          delete: () => chain(undefined)
        }),
        projectParameters: {
          id: "id",
          projectId: "projectId",
          key: "key",
          value: "value",
          secret: "secret",
          createdAt: "createdAt",
          updatedAt: "updatedAt"
        },
        workspaceParameters: {
          id: "id",
          workspaceId: "workspaceId",
          key: "key",
          value: "value",
          secret: "secret",
          createdAt: "createdAt",
          updatedAt: "updatedAt"
        }
      }
    });
    ({ ParameterRepository } = await import("./parameterRepository.js"));
  });

  it("lists project and workspace parameters", async () => {
    selectRows = [{ key: "A", value: "1" }];
    const repo = new ParameterRepository();
    assert.equal((await repo.listProjectParameters("p1")).length, 1);
    assert.equal((await repo.listWorkspaceParameters("ws1")).length, 1);
  });

  it("upsert updates existing project parameter", async () => {
    selectRows = [{ id: "ex", key: "JWT_SECRET", value: "old", secret: true }];
    lastUpdate = null;
    const repo = new ParameterRepository();
    const row = await repo.upsertProjectParameter({
      projectId: "p1",
      key: "JWT_SECRET",
      value: "new"
    });
    assert.equal(row.value, "updated");
    assert.ok(lastUpdate);
  });

  it("upsert inserts when missing", async () => {
    selectRows = [];
    lastInsert = null;
    const repo = new ParameterRepository();
    const row = await repo.upsertWorkspaceParameter({
      workspaceId: "ws1",
      key: "PUBLIC_URL",
      value: "http://x",
      secret: false
    });
    assert.equal(row.id, "new");
    assert.equal((lastInsert as { key: string }).key, "PUBLIC_URL");
  });

  it("ensureWorkspaceParameter skips non-empty existing values", async () => {
    selectRows = [{ id: "ex", key: "K", value: "filled", secret: false }];
    const repo = new ParameterRepository();
    assert.equal(
      await repo.ensureWorkspaceParameter({
        workspaceId: "ws1",
        key: "K",
        value: "new"
      }),
      false
    );
  });

  it("ensureWorkspaceParameter fills empty existing values", async () => {
    selectRows = [{ id: "ex", key: "K", value: "  ", secret: false }];
    lastUpdate = null;
    const repo = new ParameterRepository();
    assert.equal(
      await repo.ensureWorkspaceParameter({
        workspaceId: "ws1",
        key: "K",
        value: "seeded"
      }),
      true
    );
    assert.equal((lastUpdate as { value: string }).value, "seeded");
  });

  it("delete helpers run", async () => {
    const repo = new ParameterRepository();
    await repo.deleteProjectParameter("p1", "K");
    await repo.deleteWorkspaceParameter("ws1", "K");
  });
});
