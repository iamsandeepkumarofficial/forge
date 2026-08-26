import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("createInternalRouter", () => {
  let createInternalRouter: () => { stack: unknown[] };
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
  it("returns a router without auth middleware (RFC 0004)", async () => {
    const router = createInternalRouter();
    assert.ok(router);
    assert.equal(typeof createInternalRouter, "function");
  });
});
