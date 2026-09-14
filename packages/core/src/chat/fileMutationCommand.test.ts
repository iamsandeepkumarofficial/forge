import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockedWorkspaceMutationMessage,
  isBlockedWorkspaceMutationCommand
} from "./fileMutationCommand.js";

describe("fileMutationCommand", () => {
  it("denies rm and mv as the command word", () => {
    for (const cmd of [
      "rm src/a.ts",
      "rm -rf dist",
      "mv a.ts b.ts",
      "sudo rm -rf tmp",
      "/bin/rm foo",
      "/usr/bin/mv a b",
      "ls && rm x",
      "true; rm y",
      "git rm src/a.ts",
      "git mv a.ts b.ts"
    ]) {
      assert.equal(isBlockedWorkspaceMutationCommand(cmd), true, cmd);
    }
  });

  it("allows uninstall and container rm aliases", () => {
    for (const cmd of [
      "npm rm lodash",
      "docker rm container",
      "podman rm c1",
      "npm test",
      "ls",
      "echo rm",
      "git log --grep=rm",
      "git commit -m 'remove foo'"
    ]) {
      assert.equal(isBlockedWorkspaceMutationCommand(cmd), false, cmd);
    }
  });

  it("denied message points at file tools", () => {
    assert.match(blockedWorkspaceMutationMessage(), /delete_files/);
    assert.match(blockedWorkspaceMutationMessage(), /move_files/);
  });
});
