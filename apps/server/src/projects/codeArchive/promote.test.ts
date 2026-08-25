import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("codeArchive promote helpers", () => {
  let promoteGithubBranch: (options: {
    containerName: string;
    workingDir: string;
    project: { dedupeKey: string };
    branch: string;
  }) => Promise<{ target: string; branch: string }>;

  before(async () => {
    mock.module("../sandboxExec.js", {
      exports: {
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" })
      }
    });
    mock.module("../../services/storage/objectStore.js", {
      exports: {
        deleteObjectsWithPrefix: async () => undefined,
        putObject: async () => undefined
      }
    });
    ({ promoteGithubBranch } = await import("./promote.js"));
  });

  it("promoteGithubBranch rejects invalid slug", async () => {
    await assert.rejects(
      () =>
        promoteGithubBranch({
          containerName: "c",
          workingDir: "/w",
          project: { dedupeKey: "not-a-slug" },
          branch: "main"
        }),
      /Invalid GitHub slug/
    );
  });
});
