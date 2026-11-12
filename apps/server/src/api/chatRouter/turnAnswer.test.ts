import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { handleTurnAnswer } from "./turnAnswer.js";

test("handleTurnAnswer requires text or a payload", async () => {
  let status = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
    }
  };
  await handleTurnAnswer({
    req: {
      params: { sessionId: "s", turnId: "t" },
      body: {},
      forgeUser: { id: "u" }
    } as unknown as Request,
    res: res as unknown as Response,
    features: { getBySessionId: async () => null } as never,
    turns: { getById: async () => null } as never
  });
  assert.equal(status, 400);
  assert.deepEqual(body, { error: "text or payload required" });
});
