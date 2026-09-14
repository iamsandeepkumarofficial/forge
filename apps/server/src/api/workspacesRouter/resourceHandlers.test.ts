import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("workspacesRouter resourceHandlers", () => {
  let handleUpsertParameter: typeof import("./resourceHandlers.js").handleUpsertParameter;
  let N_400: number;

  before(async () => {
    mock.module("./shared.js", {
      exports: {
        N_201: 201,
        N_202: 202,
        N_204: 204,
        N_400: 400,
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
    ({ handleUpsertParameter } = await import("./resourceHandlers.js"));
    ({ N_400 } = await import("./shared.js"));
  });

  it("handleUpsertParameter requires key", async () => {
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
    await handleUpsertParameter(
      {
        body: { value: "x" },
        params: { workspaceId: "ws1" },
        forgeUser: { id: "u1" }
      } as never,
      res as never
    );
    assert.equal(res.statusCode, N_400);
    assert.deepEqual(res.body, { error: "key is required" });
  });
});
