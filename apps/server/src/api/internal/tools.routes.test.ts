import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";

function mockRes() {
  const state = { statusCode: 200, body: null, ended: false, text: null };
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
    type() {
      return res;
    },
    send(text) {
      state.text = text;
      state.body = text;
      return res;
    },
    redirect(url) {
      state.statusCode = 302;
      state.body = url;
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

describe("mountToolsRoutes", () => {
  let mountToolsRoutes;
  before(async () => {
    mock.module("../../projects/sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          repoDir: "repo",
          workingDir: "/workspace",
          sessionRoot: "/workspace"
        })
      }
    });
    mock.module("../../projects/sessionSandbox.js", {
      exports: {
        getSessionRepoInfo: async () => ({
          workingDir: "/workspace",
          repoDir: "repo",
          sessionRoot: "/workspace"
        })
      }
    });
    mock.module("../../prompts/chatAgent.prompts.js", {
      exports: {
        composeChatAgentSystemPrompt: () => "PROMPT"
      }
    });
    mock.module("../../projects/launchScaffold.js", {
      exports: {
        ensureLaunchConfig: async () => ({ ready: false, scaffolded: false })
      }
    });
    mock.module("../../tools/sandbox.tool.js", {
      exports: {
        collectSandboxChanges: async () => [],
        diffFileInSandbox: async () => ({ success: true, output: "diff" })
      }
    });
    ({ mountToolsRoutes } = await import("./tools.routes.js"));
  });
  it("prepare requires sessionId", async () => {
    const router = Router();
    mountToolsRoutes(router, {
      execute: async () => ({ kind: "error", status: 400, body: {} })
    });
    const handlers = routeHandlers(router, "post", "/prepare");
    const { res, state } = mockRes();
    await handlers[0]({ body: {} }, res);
    assert.equal(state.statusCode, 400);
  });
  it("prepare returns sandbox paths", async () => {
    const router = Router();
    mountToolsRoutes(router, {
      execute: async () => ({ kind: "result", status: 200, body: {} })
    });
    const handlers = routeHandlers(router, "post", "/prepare");
    const { res, state } = mockRes();
    await handlers[0]({ body: { sessionId: "s1" } }, res);
    assert.equal(state.body.sessionRoot, "/workspace");
    assert.equal(state.body.worktrees.repo, "/workspace");
  });
  it("chat-tool-definitions returns mode-filtered catalog text", async () => {
    const router = Router();
    mountToolsRoutes(router, {
      execute: async () => ({ kind: "error", status: 400, body: {} })
    });
    const handlers = routeHandlers(router, "get", "/chat-tool-definitions");
    const { res, state } = mockRes();
    await handlers[0]({ query: { mode: "ask" } }, res);
    assert.equal(state.statusCode, 200);
    assert.match(String(state.body.text), /read_file/);
    assert.equal(/write_file/.test(String(state.body.text)), false);
  });
});
