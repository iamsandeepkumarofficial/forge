import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  errorMessage,
  N_400,
  N_404,
  N_409,
  statusFromError
} from "./shared.js";

describe("workspacesRouter shared", () => {
  it("errorMessage stringifies unknowns", () => {
    assert.equal(errorMessage(new Error("x")), "x");
    assert.equal(errorMessage("y"), "y");
  });

  it("statusFromError maps common messages and status fields", () => {
    assert.equal(statusFromError({ status: 418 }), 418);
    assert.equal(statusFromError(new Error("not found")), N_404);
    assert.equal(statusFromError(new Error("already exists")), N_409);
    assert.equal(statusFromError(new Error("name is required")), N_400);
    assert.equal(statusFromError(new Error("boom")), 500);
  });
});
