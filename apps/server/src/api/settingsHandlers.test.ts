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

describe("settingsHandlers", () => {
  let handleGetLlmSettings: typeof import("./settingsHandlers.js").handleGetLlmSettings;
  let handlePutLlmSettings: typeof import("./settingsHandlers.js").handlePutLlmSettings;
  let stored: Record<string, string> = {};

  before(async () => {
    mock.module("../settings/forgeLlmConfig.js", {
      exports: {
        readForgeLlmConfig: async () => ({ ...stored }),
        writeForgeLlmConfig: async (llm: Record<string, string>) => {
          stored = { ...stored, ...llm };
          return { llm: stored };
        }
      }
    });
    ({ handleGetLlmSettings, handlePutLlmSettings } =
      await import("./settingsHandlers.js"));
  });

  it("get maps llm config to client fields", async () => {
    stored = {
      openaiApiKey: "oa",
      anthropicApiKey: "an",
      baseUrl: "http://b",
      apiKey: "ck",
      model: "m"
    };
    const { res, state } = mockRes();
    await handleGetLlmSettings({} as never, res);
    assert.equal(state.statusCode, 200);
    assert.deepEqual(state.body, {
      openaiApiKey: "oa",
      anthropicApiKey: "an",
      openaiCompatibleBaseUrl: "http://b",
      openaiCompatibleApiKey: "ck",
      openaiCompatibleModel: "m"
    });
  });

  it("put rejects non-object body", async () => {
    const { res, state } = mockRes();
    await handlePutLlmSettings({ body: null } as never, res);
    assert.equal(state.statusCode, 400);
  });

  it("put writes mapped fields and returns client shape", async () => {
    stored = {};
    const { res, state } = mockRes();
    await handlePutLlmSettings(
      {
        body: {
          openaiApiKey: " oa ",
          anthropicApiKey: "an",
          openaiCompatibleBaseUrl: " http://x ",
          openaiCompatibleApiKey: "k",
          openaiCompatibleModel: "model"
        }
      } as never,
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal(stored.provider, "openai-compatible");
    assert.equal(stored.openaiApiKey, "oa");
    assert.equal(stored.baseUrl, "http://x");
    assert.deepEqual(state.body, {
      openaiApiKey: "oa",
      anthropicApiKey: "an",
      openaiCompatibleBaseUrl: "http://x",
      openaiCompatibleApiKey: "k",
      openaiCompatibleModel: "model"
    });
  });
});
