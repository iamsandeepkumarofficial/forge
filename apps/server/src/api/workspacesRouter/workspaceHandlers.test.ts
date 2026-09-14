import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errorMessage, N_400, N_404, statusFromError } from "./shared.js";
import { handleCreateWorkspace } from "./workspaceHandlers.js";

describe("workspacesRouter workspaceHandlers", () => {
  it("handleCreateWorkspace rejects empty name", async () => {
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
    await handleCreateWorkspace(
      { body: { name: "  " } } as never,
      res as never
    );
    assert.equal(res.statusCode, N_400);
    assert.deepEqual(res.body, { error: "name is required" });
  });

  it("shared status helpers remain available to handlers", () => {
    assert.equal(statusFromError(new Error("not found")), N_404);
    assert.equal(errorMessage(new Error("x")), "x");
  });
});
