import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pocAuth } from "./auth.js";

function mockRes() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    }
  };
  return { res: res as never, state };
}

describe("internal pocAuth", () => {
  it("rejects missing bearer token", () => {
    const auth = pocAuth("secret");
    const { res, state } = mockRes();
    let nextCalled = false;
    auth({ headers: {} } as never, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 401);
    assert.deepEqual(state.body, { error: "missing Authorization: Bearer" });
  });

  it("rejects invalid token", () => {
    const auth = pocAuth("secret");
    const { res, state } = mockRes();
    let nextCalled = false;
    auth({ headers: { authorization: "Bearer wrong" } } as never, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 403);
    assert.deepEqual(state.body, { error: "invalid token" });
  });

  it("calls next for a valid token", () => {
    const auth = pocAuth("  secret  ");
    const { res, state } = mockRes();
    let nextCalled = false;
    auth({ headers: { authorization: "Bearer secret" } } as never, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, null);
  });
});
