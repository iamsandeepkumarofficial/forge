import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("codeArchive", () => {
  let spawnRepoTarGz: (sessionId: string) => Promise<{
    child: unknown;
    filename: string;
  }>;
  let promoteToCanonical: (sessionId: string) => Promise<unknown>;
  let chatBySession: unknown = null;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        resolveSandbox: async () => ({
          containerName: "forge-sandbox-s1",
          workingDir: "/workspace",
          repoDir: "repo"
        }),
        dockerExec: async () => ({ code: 0, stdout: "", stderr: "" })
      }
    });
    mock.module("node:child_process", {
      exports: {
        spawn: () => ({ pid: 1 }),
        execFile: (
          _file: string,
          _args: string[],
          _opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
          if (typeof cb === "function") cb(null, "", "");
          return undefined;
        }
      }
    });
    mock.module("../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId() {
            return chatBySession;
          }
        }
      }
    });
    mock.module("../catalog/projectRepository.js", {
      exports: { ProjectRepository: class {} }
    });
    mock.module("../services/storage/objectStore.js", {
      exports: {
        deleteObjectsWithPrefix: async () => undefined,
        putObject: async () => undefined
      }
    });
    ({ spawnRepoTarGz, promoteToCanonical } = await import("./codeArchive.js"));
  });

  it("spawnRepoTarGz returns docker child and filename", async () => {
    const r = await spawnRepoTarGz("s1");
    assert.equal(r.filename, "repo.tar.gz");
    assert.ok(r.child);
  });

  it("promoteToCanonical throws when chat missing", async () => {
    chatBySession = null;
    await assert.rejects(
      () => promoteToCanonical("missing"),
      /No chat\/feature found/
    );
  });
});
