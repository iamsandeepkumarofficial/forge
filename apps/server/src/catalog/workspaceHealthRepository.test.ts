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

describe("WorkspaceHealthRepository", () => {
  let WorkspaceHealthRepository: typeof import("./workspaceHealthRepository.js").WorkspaceHealthRepository;
  let selectRows: unknown[] = [];
  let lastInsert: unknown = null;

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          select: () => chain(selectRows),
          insert: () => {
            const c = chain(undefined);
            const origValues = c.values as () => typeof c;
            c.values = (v: unknown) => {
              lastInsert = v;
              return origValues();
            };
            return c;
          }
        }),
        workspaceHealth: {
          workspaceId: "workspaceId",
          status: "status",
          report: "report",
          computedAt: "computedAt"
        }
      }
    });
    ({ WorkspaceHealthRepository } =
      await import("./workspaceHealthRepository.js"));
  });

  it("get returns row or null", async () => {
    selectRows = [];
    const repo = new WorkspaceHealthRepository();
    assert.equal(await repo.get("ws1"), null);
    selectRows = [{ workspaceId: "ws1", status: "ready" }];
    assert.equal((await repo.get("ws1"))?.status, "ready");
  });

  it("setComputing writes computing status", async () => {
    lastInsert = null;
    const repo = new WorkspaceHealthRepository();
    await repo.setComputing("ws1");
    assert.equal((lastInsert as { status: string }).status, "computing");
    assert.equal((lastInsert as { workspaceId: string }).workspaceId, "ws1");
  });

  it("saveReport persists status and report", async () => {
    lastInsert = null;
    const repo = new WorkspaceHealthRepository();
    const report = {
      status: "warnings" as const,
      computedAt: "2026-01-01T00:00:00.000Z",
      members: [],
      findings: [],
      dependsOnGraph: []
    };
    await repo.saveReport({ workspaceId: "ws1", status: "warnings", report });
    assert.equal((lastInsert as { status: string }).status, "warnings");
    assert.equal((lastInsert as { report: unknown }).report, report);
  });
});
