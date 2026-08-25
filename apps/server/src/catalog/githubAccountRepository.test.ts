import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function thenable(value: unknown) {
  return {
    then(
      onFulfilled: (v: unknown) => unknown,
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
    "onConflictDoUpdate"
  ]) {
    api[m] = () => api;
  }
  api.returning = async () => finalValue;
  Object.assign(api, thenable(finalValue));
  return api;
}

describe("GithubAccountRepository", () => {
  let GithubAccountRepository: new () => {
    getByUserId: (userId: string) => Promise<{ id: string } | null>;
    upsert: (input: Record<string, unknown>) => Promise<{ id: string }>;
    deleteByUserId: (userId: string) => Promise<void>;
  };

  before(async () => {
    mock.module("@forge/db", {
      exports: {
        getDb: () => ({
          insert: () => chain([{ id: "g1", userId: "u1" }]),
          select: () => chain([{ id: "g1", userId: "u1", accessToken: "tok" }]),
          delete: () => chain(undefined),
          update: () => chain(undefined)
        }),
        userGithubAccounts: { id: "id", userId: "userId" }
      }
    });
    ({ GithubAccountRepository } =
      await import("./githubAccountRepository.js"));
  });

  it("getByUserId returns account rows", async () => {
    const repo = new GithubAccountRepository();
    const row = await repo.getByUserId("u1");
    assert.equal(row?.id, "g1");
  });

  it("upsert and deleteByUserId run against mocked db", async () => {
    const repo = new GithubAccountRepository();
    const upserted = await repo.upsert({
      userId: "u1",
      githubUserId: "1",
      githubLogin: "octocat",
      accessToken: "tok"
    });
    assert.equal(upserted.id, "g1");
    await repo.deleteByUserId("u1");
  });
});
