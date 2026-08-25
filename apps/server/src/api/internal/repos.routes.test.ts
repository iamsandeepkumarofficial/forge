import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";

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
function routeHandlers(router, method, routePath) {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    if (layer.route.path !== routePath) continue;
    if (!layer.route.methods[method]) continue;
    return layer.route.stack.map((s) => s.handle);
  }
  return [];
}

describe("mountReposRoutes", () => {
  let mountReposRoutes;
  before(async () => {
    mock.module("../../services/codebase/codebase.service.js", {
      exports: {
        listManagedRepos: async () => ({ managedRoot: "/tmp/r", repos: ["a"] }),
        cloneGithubRepo: async (slug) => ({
          path: "/tmp/" + slug,
          alreadyExisted: false
        })
      }
    });
    ({ mountReposRoutes } = await import("./repos.routes.js"));
  });
  it("GET /repos returns managed list", async () => {
    const router = Router();
    mountReposRoutes(router);
    const handlers = routeHandlers(router, "get", "/repos");
    const { res, state } = mockRes();
    await handlers[0]({}, res);
    assert.deepEqual(state.body, { managedRoot: "/tmp/r", repos: ["a"] });
  });
  it("POST /repos/github requires slug", async () => {
    const router = Router();
    mountReposRoutes(router);
    const handlers = routeHandlers(router, "post", "/repos/github");
    const { res, state } = mockRes();
    await handlers[0]({ body: {} }, res);
    assert.equal(state.statusCode, 400);
  });
  it("POST /repos/github clones when slug present", async () => {
    const router = Router();
    mountReposRoutes(router);
    const handlers = routeHandlers(router, "post", "/repos/github");
    const { res, state } = mockRes();
    await handlers[0]({ body: { slug: "o/r", shallow: true } }, res);
    assert.equal(state.body.alreadyExisted, false);
    assert.match(state.body.path, /o\/r/);
  });
});
