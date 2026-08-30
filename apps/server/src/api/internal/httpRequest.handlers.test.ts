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
  return { res, state };
}

describe("httpRequest.handlers", { concurrency: false }, () => {
  let handleAppHttpRequest: typeof import("./httpRequest.handlers.js").handleAppHttpRequest;

  before(async () => {
    mock.module("../../projects/appRunner.js", {
      exports: {
        listAppStatuses: async () => ({
          exists: true,
          apps: [
            {
              name: "api",
              type: "api",
              cwd: ".",
              command: "dev",
              port: 3000,
              running: true,
              hostPort: 13000,
              url: "http://p3000-s.preview.localhost:8081/"
            }
          ]
        })
      }
    });
    ({ handleAppHttpRequest } = await import("./httpRequest.handlers.js"));
  });

  it("requires sessionId and appName", async () => {
    const { res, state } = mockRes();
    await handleAppHttpRequest({ body: {} } as never, res as never);
    assert.equal(state.statusCode, 400);
  });

  it("proxies to the session app and returns status", async () => {
    const { res, state } = mockRes();
    const fetchMock = async (url: string) => {
      assert.equal(url, "http://127.0.0.1:13000/health");
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"ok":true}'
      };
    };
    const prev = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await handleAppHttpRequest(
        {
          body: {
            sessionId: "s1",
            appName: "api",
            method: "GET",
            path: "/health"
          }
        } as never,
        res as never
      );
    } finally {
      globalThis.fetch = prev;
    }
    assert.equal(state.statusCode, 200);
    const body = state.body as { status: number; body: string; url: string };
    assert.equal(body.status, 200);
    assert.equal(body.body, '{"ok":true}');
    assert.equal(body.url, "http://127.0.0.1:13000/health");
  });
});
