import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
  const state = { statusCode: 200, body: null, ended: false, headers: {} };
  const res = {
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(body) {
      state.body = body;
      return res;
    },
    end() {
      state.ended = true;
      return res;
    },
    redirect(url) {
      state.statusCode = 302;
      state.body = url;
      return res;
    },
    setHeader() {
      return res;
    }
  };
  return { res, state };
}

describe("createPocAuth", () => {
  let createPocAuth;
  before(async () => {
    mock.module("../catalog/repository.js", {
      exports: {
        CatalogRepository: class {
          async getOrCreateUser(email) {
            return { id: "u1", email };
          }
        }
      }
    });
    ({ createPocAuth } = await import("./pocAuth.js"));
  });
  it("rejects missing bearer", async () => {
    const auth = createPocAuth("tok");
    const { res, state } = mockRes();
    await auth({ headers: {} }, res, () => {});
    assert.equal(state.statusCode, 401);
  });
  it("rejects bad token", async () => {
    const auth = createPocAuth("tok");
    const { res, state } = mockRes();
    await auth({ headers: { authorization: "Bearer nope" } }, res, () => {});
    assert.equal(state.statusCode, 403);
  });
  it("sets forgeUser and calls next", async () => {
    const auth = createPocAuth("tok");
    const { res, state } = mockRes();
    const req = {
      headers: { authorization: "Bearer tok", "x-forge-user-email": "a@b.c" }
    };
    let next = false;
    await auth(req, res, () => {
      next = true;
    });
    assert.equal(next, true);
    assert.equal(req.forgeUser.email, "a@b.c");
    assert.equal(state.statusCode, 200);
  });
});
