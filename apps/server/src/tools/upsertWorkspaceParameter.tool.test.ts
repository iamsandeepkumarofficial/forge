import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("executeUpsertWorkspaceParameter", () => {
  let executeUpsertWorkspaceParameter: typeof import("./upsertWorkspaceParameter.tool.js").executeUpsertWorkspaceParameter;
  const upserts: Array<Record<string, unknown>> = [];

  before(async () => {
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            if (sessionId === "s-ws") return { workspaceId: "ws1" };
            if (sessionId === "s-proj")
              return { workspaceId: null, projectId: "p1" };
            return null;
          }
        }
      }
    });
    mock.module("../catalog/parameterRepository.js", {
      exports: {
        ParameterRepository: class {
          async upsertWorkspaceParameter(input: Record<string, unknown>) {
            upserts.push(input);
            return input;
          }
        }
      }
    });
    mock.module("../services/eval/phoenix.js", {
      exports: {
        emitSetupAgentEval: async () => undefined
      }
    });
    ({ executeUpsertWorkspaceParameter } =
      await import("./upsertWorkspaceParameter.tool.js"));
  });

  it("rejects invalid keys", async () => {
    upserts.length = 0;
    for (const key of ["", "lowercase", "1BAD", "HAS-DASH"]) {
      const r = await executeUpsertWorkspaceParameter({
        sessionId: "s-ws",
        args: { key, value: "x" }
      });
      assert.equal(r.success, false);
      assert.match(r.output, /ENV-style/);
    }
    assert.equal(upserts.length, 0);
  });

  it("requires a workspace session", async () => {
    const r = await executeUpsertWorkspaceParameter({
      sessionId: "s-proj",
      args: { key: "JWT_SECRET", value: "s" }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /workspace sessions/);
  });

  it("upserts and infers secret from key name", async () => {
    upserts.length = 0;
    const r = await executeUpsertWorkspaceParameter({
      sessionId: "s-ws",
      args: { key: "JWT_SECRET", value: "tok" }
    });
    assert.equal(r.success, true);
    assert.equal(r.metadata?.key, "JWT_SECRET");
    assert.equal(r.metadata?.secret, true);
    assert.deepEqual(upserts[0], {
      workspaceId: "ws1",
      key: "JWT_SECRET",
      value: "tok",
      secret: true
    });
  });

  it("honors explicit secret flag", async () => {
    upserts.length = 0;
    const r = await executeUpsertWorkspaceParameter({
      sessionId: "s-ws",
      args: { key: "PUBLIC_URL", value: "http://x", secret: false }
    });
    assert.equal(r.success, true);
    assert.equal(upserts[0]!.secret, false);
  });

  it("upserts multiple items after validating all keys", async () => {
    upserts.length = 0;
    const r = await executeUpsertWorkspaceParameter({
      sessionId: "s-ws",
      args: {
        items: [
          { key: "CLIENT_URL", value: "http://x", secret: false },
          { key: "JWT_SECRET", value: "tok" }
        ]
      }
    });
    assert.equal(r.success, true);
    assert.deepEqual(r.metadata?.keys, ["CLIENT_URL", "JWT_SECRET"]);
    assert.equal(upserts.length, 2);
    assert.equal(upserts[0]!.key, "CLIENT_URL");
    assert.equal(upserts[1]!.key, "JWT_SECRET");
  });

  it("rejects the whole batch when any key is invalid", async () => {
    upserts.length = 0;
    const r = await executeUpsertWorkspaceParameter({
      sessionId: "s-ws",
      args: {
        items: [
          { key: "CLIENT_URL", value: "http://x" },
          { key: "bad-key", value: "x" }
        ]
      }
    });
    assert.equal(r.success, false);
    assert.match(r.output, /ENV-style/);
    assert.equal(upserts.length, 0);
  });
});
