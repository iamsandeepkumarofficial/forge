import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preferredSandboxImageName,
  DEFAULT_SANDBOX_IMAGE
} from "./constants.js";

describe("sessionSandbox container helpers", () => {
  it("preferredSandboxImageName falls back to default", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    try {
      assert.equal(preferredSandboxImageName(), DEFAULT_SANDBOX_IMAGE);
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
    }
  });
});
