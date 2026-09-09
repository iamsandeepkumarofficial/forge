import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

describe("sandboxChanges.tool", () => {
  it("exports collectSandboxChanges and diffFileInSandbox", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, "sandboxChanges.tool.ts"), "utf8");
    assert.match(src, /export async function collectSandboxChanges/);
    assert.match(src, /export async function diffFileInSandbox/);
    assert.match(src, /sessionId/);
  });
});
