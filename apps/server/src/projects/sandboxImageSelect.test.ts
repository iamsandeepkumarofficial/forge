import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SANDBOX_IMAGE,
  GENERIC_SANDBOX_IMAGE
} from "./sessionSandbox/constants.js";

describe("selectSandboxImageForWorkspace", () => {
  let selectSandboxImageForWorkspace: typeof import("./sandboxImageSelect.js").selectSandboxImageForWorkspace;
  let hasNode = false;
  const prevOverride = process.env.FORGE_SANDBOX_IMAGE;

  before(async () => {
    mock.module("../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async listMembers() {
            return [{ projectId: "p1", repoName: "api" }];
          }
        }
      }
    });
    mock.module("../catalog/projectRepository.js", {
      exports: {
        ProjectRepository: class {
          async getById() {
            return {
              id: "p1",
              source: "local",
              canonicalKey: "/tmp/repo"
            };
          }
        }
      }
    });
    mock.module("./repoFacts.js", {
      exports: {
        readRepoFactsFromHost: () => ({ analyzable: true }),
        factsHaveNodeEvidence: () => hasNode
      }
    });
    ({ selectSandboxImageForWorkspace } =
      await import("./sandboxImageSelect.js"));
  });

  it("picks node image when evidence is present", async () => {
    delete process.env.FORGE_SANDBOX_IMAGE;
    hasNode = true;
    assert.equal(
      await selectSandboxImageForWorkspace("ws1"),
      DEFAULT_SANDBOX_IMAGE
    );
  });

  it("picks generic image without node evidence", async () => {
    delete process.env.FORGE_SANDBOX_IMAGE;
    hasNode = false;
    assert.equal(
      await selectSandboxImageForWorkspace("ws1"),
      GENERIC_SANDBOX_IMAGE
    );
    if (prevOverride !== undefined) {
      process.env.FORGE_SANDBOX_IMAGE = prevOverride;
    }
  });
});
