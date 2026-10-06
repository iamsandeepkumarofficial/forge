import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

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

describe("createProjectsRouter", () => {
  let createProjectsRouter: () => {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: Array<{ handle: (...args: never[]) => unknown }>;
      };
    }>;
  };

  before(async () => {
    mock.module("./pocAuth.js", {
      exports: {
        createLocalUserMiddleware:
          () => (_r: unknown, _s: unknown, n: () => void) =>
            n(),
        createLocalUserMiddleware:
          () => (_r: unknown, _s: unknown, n: () => void) =>
            n(),
        createPocAuth: () => (_r: unknown, _s: unknown, n: () => void) => n()
      }
    });
    mock.module("../services/project/project.service.js", {
      exports: {
        ProjectService: class {
          async connectGithub(slug: string, userId: string) {
            return {
              projectId: "p1",
              workspaceId: "w1",
              alreadyConnected: false,
              slug,
              userId
            };
          }
          async connectLocalFolder(options: {
            localPath: string;
            userId: string;
          }) {
            return {
              projectId: "p-local",
              workspaceId: "w-local",
              ...options
            };
          }
          async connectGitUrl(gitUrl: string, userId: string) {
            return {
              projectId: "p-git",
              workspaceId: "w-git",
              alreadyConnected: false,
              gitUrl,
              userId
            };
          }
          async listProjects() {
            return [{ id: "p1", name: "n" }];
          }
          async getProjectById(id: string) {
            return id === "p1"
              ? {
                  id: "p1",
                  name: "n",
                  source: "github",
                  status: "available",
                  createdAt: "2024-01-01T00:00:00.000Z"
                }
              : null;
          }
          async deleteProject() {}
        }
      }
    });
    ({ createProjectsRouter } = await import("./projectsRouter.js"));
  });

  it("rejects github connect without slug", async () => {
    const router = createProjectsRouter();
    const handlers = routeHandlers(router, "post", "/github");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      { body: {}, forgeUser: { id: "u1" } } as never,
      res
    );
    assert.equal(state.statusCode, 400);
  });

  it("connects github slug", async () => {
    const router = createProjectsRouter();
    const handlers = routeHandlers(router, "post", "/github");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        body: { github: "octocat/Hello-World" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal((state.body as { projectId: string }).projectId, "p1");
  });

  it("creates project from localPath", async () => {
    const router = createProjectsRouter();
    const handlers = routeHandlers(router, "post", "/");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        body: { localPath: "/tmp/my-repo" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal((state.body as { projectId: string }).projectId, "p-local");
  });

  it("creates project from gitUrl", async () => {
    const router = createProjectsRouter();
    const handlers = routeHandlers(router, "post", "/");
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        body: { gitUrl: "https://github.com/octocat/Hello-World" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal((state.body as { projectId: string }).projectId, "p-git");
  });
});
