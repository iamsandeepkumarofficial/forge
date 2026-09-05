import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { N_400 } from "./shared.js";
import { handleAddProject } from "./projectHandlers.js";

describe("workspacesRouter projectHandlers", () => {
  it("handleAddProject requires projectId", async () => {
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
    await handleAddProject(
      {
        body: {},
        params: { workspaceId: "ws1" },
        forgeUser: { id: "u1" }
      } as never,
      res as never
    );
    assert.equal(res.statusCode, N_400);
    assert.deepEqual(res.body, { error: "projectId is required" });
  });
});
