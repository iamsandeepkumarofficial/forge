import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SANDBOX_IMAGE,
  GENERIC_SANDBOX_IMAGE,
  preferredSandboxImageName,
  selectSandboxImageName
} from "./constants.js";

describe("sandbox image selection", () => {
  it("preferredSandboxImageName falls back to default", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    try {
      assert.equal(preferredSandboxImageName(), DEFAULT_SANDBOX_IMAGE);
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
    }
  });

  it("selectSandboxImageName: Node evidence → forge-sandbox", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    try {
      assert.equal(
        selectSandboxImageName({ hasNodeEvidence: true }),
        DEFAULT_SANDBOX_IMAGE
      );
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
    }
  });

  it("selectSandboxImageName: no Node → generic", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    delete process.env.FORGE_SANDBOX_IMAGE;
    try {
      assert.equal(
        selectSandboxImageName({ hasNodeEvidence: false }),
        GENERIC_SANDBOX_IMAGE
      );
      assert.equal(selectSandboxImageName({}), GENERIC_SANDBOX_IMAGE);
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
    }
  });

  it("selectSandboxImageName honors FORGE_SANDBOX_IMAGE override", () => {
    const prev = process.env.FORGE_SANDBOX_IMAGE;
    process.env.FORGE_SANDBOX_IMAGE = "custom:tag";
    try {
      assert.equal(
        selectSandboxImageName({ hasNodeEvidence: false }),
        "custom:tag"
      );
    } finally {
      if (prev !== undefined) process.env.FORGE_SANDBOX_IMAGE = prev;
      else delete process.env.FORGE_SANDBOX_IMAGE;
    }
  });
});
