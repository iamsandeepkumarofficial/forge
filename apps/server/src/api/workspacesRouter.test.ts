import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
  const state: {
    statusCode: number;
    body: unknown;
    ended: boolean;
  } = {
    statusCode: 200,
    body: null,
    ended: false
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    end() {
      state.ended = true;
      return res;
    }
  };
  return { res: res as never, state };
}

function routeHandlers(
  router: {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: Array<{ handle: (...args: never[]) => unknown }>;
      };
    }>;
  },
  method: string,
  routePath: string
) {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    if (layer.route.path !== routePath) continue;
    if (!layer.route.methods[method]) continue;
    return layer.route.stack.map((s) => s.handle);
  }
  return [];
}

describe("createWorkspacesRouter", () => {
  let createWorkspacesRouter: typeof import("./workspacesRouter.js").createWorkspacesRouter;
  let listThrow: Error | null = null;

  before(async () => {
    mock.module("./pocAuth.js", {
      exports: {
        createLocalUserMiddleware:
          () =>
          (
            req: { forgeUser?: { id: string } },
            _res: unknown,
            next: () => void
          ) => {
            req.forgeUser = { id: "u1" };
            next();
          }
      }
    });
    mock.module("../services/workspace/workspace.service.js", {
      exports: {
        WorkspaceService: class {
          async createWorkspace(_userId: string, name: string) {
            return { id: "ws1", name, members: [] };
          }
          async listWorkspaces() {
            if (listThrow) throw listThrow;
            return [{ id: "ws1", name: "Demo" }];
          }
          async getWorkspaceDetail(id: string) {
            if (id === "missing") {
              const err = new Error("Workspace not found") as Error & {
                status: number;
              };
              err.status = 404;
              throw err;
            }
            return { id, name: "Demo", members: [] };
          }
          async deleteWorkspace() {}
          async renameWorkspace(options: {
            workspaceId: string;
            userId: string;
            name: string;
          }) {
            return { id: "ws1", name: options.name, members: [] };
          }
          async setRoutes() {
            return { id: "ws1", name: "Demo", members: [], routes: [] };
          }
          async addProject() {
            return { id: "ws1", members: [{ projectId: "p1" }] };
          }
          async removeProject() {
            return { id: "ws1", members: [] };
          }
        }
      }
    });
    mock.module("../projects/chatFeatureService.js", {
      exports: {
        ChatFeatureService: class {
          async createWorkspaceChat() {
            return { id: "chat1", sessionId: "s1" };
          }
        }
      }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {}
      }
    });
    mock.module("../projects/sessionSandbox.js", {
      exports: {
        destroySessionSandbox: async () => undefined,
        provisionSessionSandbox: async () => undefined
      }
    });
    mock.module("../projects/sessionProvision.js", {
      exports: {
        finalizeSessionProvision: async () => undefined
      }
    });
    mock.module("../catalog/parameterRepository.js", {
      exports: {
        ParameterRepository: class {
          async listWorkspaceParameters() {
            return [{ key: "JWT_SECRET", value: "x", secret: true }];
          }
          async upsertWorkspaceParameter() {
            return { key: "K", value: "v" };
          }
          async deleteWorkspaceParameter() {}
        }
      }
    });
    mock.module("../catalog/workspaceHealthRepository.js", {
      exports: {
        WorkspaceHealthRepository: class {
          async get() {
            return { status: "ready", report: {} };
          }
        }
      }
    });
    mock.module("../services/workspace/workspaceHealthJob.js", {
      exports: {
        runWorkspaceAnalyzeAndPrepare: async () => undefined
      }
    });
    ({ createWorkspacesRouter } = await import("./workspacesRouter.js"));
  });

  it("POST / rejects missing name", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "post", "/");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      { body: {}, forgeUser: { id: "u1" } } as never,
      res
    );
    assert.equal(state.statusCode, 400);
  });

  it("POST / creates workspace", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "post", "/");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      { body: { name: "Demo" }, forgeUser: { id: "u1" } } as never,
      res
    );
    assert.equal((state.body as { id: string }).id, "ws1");
  });

  it("GET / lists workspaces and maps errors", async () => {
    listThrow = null;
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "get", "/");
    const ok = mockRes();
    await handlers[handlers.length - 1]!(
      { forgeUser: { id: "u1" } } as never,
      ok.res
    );
    assert.deepEqual(ok.state.body, {
      workspaces: [{ id: "ws1", name: "Demo" }]
    });

    listThrow = Object.assign(new Error("already exists"), { status: 409 });
    const bad = mockRes();
    await handlers[handlers.length - 1]!(
      { forgeUser: { id: "u1" } } as never,
      bad.res
    );
    assert.equal(bad.state.statusCode, 409);
    listThrow = null;
  });

  it("GET /:workspaceId returns 404 for missing", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "get", "/:workspaceId");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { workspaceId: "missing" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 404);
  });

  it("PATCH /:workspaceId requires name or routes", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "patch", "/:workspaceId");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { workspaceId: "ws1" },
        body: {},
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 400);
  });

  it("POST /:workspaceId/projects requires projectId", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "post", "/:workspaceId/projects");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { workspaceId: "ws1" },
        body: {},
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 400);
  });

  it("DELETE /:workspaceId returns 204", async () => {
    const router = createWorkspacesRouter();
    const handlers = routeHandlers(router, "delete", "/:workspaceId");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { workspaceId: "ws1" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 204);
    assert.equal(state.ended, true);
  });
});
