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

describe("createInternalRouter", () => {
  let createInternalRouter;
  before(async () => {
    mock.module("../../catalog/chatFeatureRepository.js", {
      exports: { ChatFeatureRepository: class {} }
    });
    mock.module("../../projects/chatFeatureService.js", {
      exports: {
        ChatFeatureService: class {
          constructor() {}
        }
      }
    });
    mock.module("../../tools/preview.tool.js", {
      exports: { PreviewToolService: class {} }
    });
    mock.module("../../tools/tool.service.js", {
      exports: {
        ToolService: class {
          constructor() {}
        }
      }
    });
    mock.module("./chat.routes.js", {
      exports: { mountChatRoutes: () => undefined }
    });
    mock.module("./repos.routes.js", {
      exports: { mountReposRoutes: () => undefined }
    });
    mock.module("./session.routes.js", {
      exports: { mountSessionRoutes: () => undefined }
    });
    mock.module("./tools.routes.js", {
      exports: { mountToolsRoutes: () => undefined }
    });
    ({ createInternalRouter } = await import("./internal.router.js"));
  });
  it("returns a router that rejects missing auth", async () => {
    const router = createInternalRouter("secret");
    assert.ok(router.stack.length >= 1);
    const authLayer = router.stack[0];
    const { res, state } = mockRes();
    authLayer.handle({ headers: {} }, res, () => {});
    assert.equal(state.statusCode, 401);
  });
});
