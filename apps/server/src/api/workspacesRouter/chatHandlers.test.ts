import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("workspacesRouter chatHandlers", () => {
  let handleGetChat: typeof import("./chatHandlers.js").handleGetChat;
  let N_404: number;

  before(async () => {
    mock.module("../pocAuth.js", {
      exports: {}
    });
    mock.module("./shared.js", {
      exports: {
        N_201: 201,
        N_204: 204,
        N_404: 404,
        chatFeatureService: {},
        chatRepo: {
          async getById(id: string) {
            if (id === "missing") return null;
            return {
              id,
              workspaceId: "ws1",
              userId: "u1",
              sessionId: "s1"
            };
          }
        },
        workspaceService: {
          async getWorkspaceDetail() {
            return { id: "ws1" };
          }
        },
        errorMessage: (e: unknown) =>
          e instanceof Error ? e.message : String(e),
        statusFromError: () => 500
      }
    });
    mock.module("../../projects/sessionSandbox.js", {
      exports: {
        destroySessionSandbox: async () => undefined,
        provisionSessionSandbox: async () => undefined
      }
    });
    mock.module("../../projects/sessionProvision.js", {
      exports: { finalizeSessionProvision: async () => undefined }
    });
    ({ handleGetChat } = await import("./chatHandlers.js"));
    ({ N_404 } = await import("./shared.js"));
  });

  it("handleGetChat returns 404 when chat is missing", async () => {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };
    await handleGetChat(
      {
        params: { workspaceId: "ws1", chatId: "missing" },
        forgeUser: { id: "u1" }
      } as never,
      res as never
    );
    assert.equal(res.statusCode, N_404);
  });
});
