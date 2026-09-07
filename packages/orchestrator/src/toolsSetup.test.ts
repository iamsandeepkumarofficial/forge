import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { hostModeHidesDockerImageLookup } from "./tools.js";

describe("hostModeHidesDockerImageLookup", () => {
  const prevRuntime = process.env.SANDBOX_RUNTIME;
  const prevDesktop = process.env.FORGE_DESKTOP;

  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.SANDBOX_RUNTIME;
    else process.env.SANDBOX_RUNTIME = prevRuntime;
    if (prevDesktop === undefined) delete process.env.FORGE_DESKTOP;
    else process.env.FORGE_DESKTOP = prevDesktop;
  });

  it("hides docker_image_lookup for host runtime", () => {
    process.env.SANDBOX_RUNTIME = "host";
    assert.equal(hostModeHidesDockerImageLookup(), true);
    process.env.SANDBOX_RUNTIME = "docker";
    assert.equal(hostModeHidesDockerImageLookup(), false);
  });
});
