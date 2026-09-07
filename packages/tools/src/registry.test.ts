import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createChatToolRegistry,
  createForwardableToolRegistry
} from "./registry.js";
import type { ToolRun } from "./types.js";

const run: ToolRun = async () => ({ success: true, output: "ok" });

describe("registry", () => {
  it("builds forwardable tools and optional web/docker gates", () => {
    const base = createForwardableToolRegistry(run, {
      includeWebTools: false,
      includeDockerImageLookup: false
    });
    assert.ok(base.read_file);
    assert.ok(base.run_terminal);
    assert.equal("web_search" in base, false);
    assert.equal("docker_image_lookup" in base, false);

    const withExtras = createForwardableToolRegistry(run, {
      includeWebTools: true,
      includeDockerImageLookup: true
    });
    assert.ok(withExtras.web_search);
    assert.ok(withExtras.docker_image_lookup);
  });

  it("createChatToolRegistry adds HITL tools", () => {
    const reg = createChatToolRegistry({
      run,
      currentMode: "ask",
      includeWebTools: false,
      includeDockerImageLookup: true
    });
    assert.ok(reg.switch_mode);
    assert.ok(reg.ask_user);
  });
});
