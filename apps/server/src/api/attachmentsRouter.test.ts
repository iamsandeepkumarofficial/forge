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

describe("createAttachmentsRouter", () => {
  let createAttachmentsRouter: () => {
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
        createPocAuth: () => (_r: unknown, _s: unknown, n: () => void) => n()
      }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getById(id: string) {
            return id === "c1"
              ? { id: "c1", projectId: "p1", userId: "u1" }
              : null;
          }
          async updateLastActivity() {}
        }
      }
    });
    mock.module("../catalog/attachmentRepository.js", {
      exports: {
        AttachmentRepository: class {
          async listByChatFeatureId() {
            return [];
          }
          async create(row: Record<string, unknown>) {
            return { id: "a1", ...row };
          }
          async getById() {
            return null;
          }
          async delete() {}
        }
      }
    });
    mock.module("../services/storage/objectStore.js", {
      exports: {
        putObject: async () => undefined,
        getObject: async () => null,
        deleteObject: async () => undefined,
        ticketAttachmentKey: (c: string, a: string) => `tickets/${c}/att/${a}`
      }
    });
    mock.module("multer", {
      exports: {
        default: Object.assign(
          () => ({
            single: () => (_req: unknown, _res: unknown, next: () => void) =>
              next()
          }),
          {
            memoryStorage: () => ({})
          }
        )
      }
    });
    ({ createAttachmentsRouter } = await import("./attachmentsRouter.js"));
  });

  it("upload fails without file", async () => {
    const router = createAttachmentsRouter();
    const handlers = routeHandlers(
      router,
      "post",
      "/:projectId/chats/:chatId/attachments"
    );
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { projectId: "p1", chatId: "c1" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.equal(state.statusCode, 400);
    assert.match(
      String((state.body as { error: string }).error),
      /No file uploaded/
    );
  });

  it("lists attachments for owned chat", async () => {
    const router = createAttachmentsRouter();
    const handlers = routeHandlers(
      router,
      "get",
      "/:projectId/chats/:chatId/attachments"
    );
    const { res, state } = mockRes();
    await handlers[handlers.length - 1]!(
      {
        params: { projectId: "p1", chatId: "c1" },
        forgeUser: { id: "u1" }
      } as never,
      res
    );
    assert.deepEqual(state.body, []);
  });
});
