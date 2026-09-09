import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hostModeHidesDockerImageLookup } from "./tools.js";

describe("hostModeHidesDockerImageLookup", () => {
  it("does not hide docker_image_lookup at registry level", () => {
    assert.equal(hostModeHidesDockerImageLookup(), false);
  });
});
