import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  assertLocalFolderPath,
  assertSafeBranch,
  cloneGithubIntoSubdirScript,
  cloneGithubWorkspaceScript,
  repoDirForProject
} from "./materialize.js";
import { WORKSPACE_MOUNT } from "./constants.js";

describe("sessionSandbox materialize helpers", () => {
  it("assertSafeBranch rejects unsafe names", () => {
    assert.throws(() => assertSafeBranch("../x"), /Unsafe branch/);
    assert.doesNotThrow(() => assertSafeBranch("feature/ok"));
  });

  it("repoDirForProject sanitizes the project display name", () => {
    assert.equal(
      repoDirForProject({
        source: "local",
        name: "My App!",
        dedupeKey: "x"
      } as never),
      "My-App"
    );
  });

  it("repoDirForProject falls back to repo for local without a name", () => {
    assert.equal(
      repoDirForProject({
        source: "local",
        name: "",
        dedupeKey: "x"
      } as never),
      "repo"
    );
  });

  it("repoDirForProject falls back to GitHub slug when name is empty", () => {
    assert.equal(
      repoDirForProject({
        source: "github",
        name: "  ",
        dedupeKey: "acme/widgets"
      } as never),
      "widgets"
    );
  });

  it("repoDirForProject prefers display name over GitHub slug", () => {
    assert.equal(
      repoDirForProject({
        source: "github",
        name: "Widgets UI",
        dedupeKey: "acme/widgets"
      } as never),
      "Widgets-UI"
    );
  });

  it("cloneGithubIntoSubdirScript unpacks into /workspace/<repo>", () => {
    const script = cloneGithubIntoSubdirScript("widgets");
    assert.match(
      script,
      new RegExp(`cp -a /tmp/forge-src/\\. "${WORKSPACE_MOUNT}/widgets/"`)
    );
    assert.match(script, new RegExp(`cd "${WORKSPACE_MOUNT}/widgets"`));
  });

  it("cloneGithubWorkspaceScript unpacks into /workspace", () => {
    const script = cloneGithubWorkspaceScript();
    assert.match(
      script,
      new RegExp(`cp -a /tmp/forge-src/\\. "${WORKSPACE_MOUNT}/"`)
    );
    assert.match(script, new RegExp(`cd "${WORKSPACE_MOUNT}"`));
    assert.doesNotMatch(script, /\/\$DIR/);
  });

  it("assertLocalFolderPath requires absolute existing directory", async () => {
    await assert.rejects(
      () => assertLocalFolderPath("relative/path"),
      /must be absolute/
    );
    await assert.rejects(
      () => assertLocalFolderPath("/nonexistent-forge-local-folder-xyz"),
      /does not exist/
    );
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-local-"));
    try {
      const resolved = await assertLocalFolderPath(dir);
      assert.equal(resolved, dir);
      const file = path.join(dir, "not-a-dir");
      await fs.writeFile(file, "x");
      await assert.rejects(
        () => assertLocalFolderPath(file),
        /not a directory/
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
