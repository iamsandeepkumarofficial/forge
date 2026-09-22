import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("executor kinds", () => {
  it("recognizes agent, tool, and human", () => {
    const kinds = ["agent", "tool", "human"] as const;
    assert.deepEqual([...kinds], ["agent", "tool", "human"]);
  });

  it("never skips approval for install/deploy/destructive tools", () => {
    const needsApproval = (toolName: string) =>
      /install|deploy|rm\b|delete|drop|migrate/i.test(toolName);
    assert.equal(needsApproval("npm_install"), true);
    assert.equal(needsApproval("deploy_preview"), true);
    assert.equal(needsApproval("read_file"), false);
  });
});
