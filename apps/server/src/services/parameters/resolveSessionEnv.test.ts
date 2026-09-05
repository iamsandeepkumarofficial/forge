import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("resolveSessionEnv", () => {
  let resolveSessionEnv: typeof import("./resolveSessionEnv.js").resolveSessionEnv;
  let forgeProvidedKeysForWorkspace: typeof import("./resolveSessionEnv.js").forgeProvidedKeysForWorkspace;

  before(async () => {
    mock.module("../../catalog/chatFeatureRepository.js", {
      exports: {
        ChatFeatureRepository: class {
          async getBySessionId(sessionId: string) {
            if (sessionId === "s-ws") {
              return { id: "c1", workspaceId: "ws1", projectId: null };
            }
            if (sessionId === "s-proj") {
              return { id: "c2", workspaceId: null, projectId: "p1" };
            }
            return null;
          }
        }
      }
    });
    mock.module("../../catalog/workspaceRepository.js", {
      exports: {
        WorkspaceRepository: class {
          async listMembers() {
            return [
              { projectId: "p1", repoName: "api" },
              { projectId: "p2", repoName: "web" }
            ];
          }
        }
      }
    });
    mock.module("../../catalog/parameterRepository.js", {
      exports: {
        ParameterRepository: class {
          async listWorkspaceParameters() {
            return [
              { key: "JWT_SECRET", value: "s" },
              { key: "HOST", value: "should-skip" },
              { key: "PUBLIC_URL", value: "http://ws" }
            ];
          }
          async listProjectParameters(projectId: string) {
            if (projectId === "p1") {
              return [{ key: "API_ONLY", value: "1" }];
            }
            return [{ key: "WEB_ONLY", value: "2" }];
          }
        }
      }
    });
    mock.module("../../projects/sessionAppDb.js", {
      exports: {
        sessionAppDbEnvFor: (sessionId: string) => ({
          SESSION_DB: `db-for-${sessionId}`
        }),
        workspaceAppDbEnv: async () => ({
          DATABASE_URL: "postgresql://forge@postgres-apps/db"
        })
      }
    });
    mock.module("../../catalog/workspaceDatabaseRepository.js", {
      exports: {
        WorkspaceDatabaseRepository: class {
          async list() {
            return [{ engineId: "postgres" }, { engineId: "mongo" }];
          }
        }
      }
    });
    mock.module("../../projects/appDb/engines.js", {
      exports: {
        getAppDbEngine: (id: string) =>
          id === "postgres"
            ? { envKey: "DATABASE_URL" }
            : id === "mongo"
              ? { envKey: "MONGODB_URI" }
              : null
      }
    });
    ({ resolveSessionEnv, forgeProvidedKeysForWorkspace } =
      await import("./resolveSessionEnv.js"));
  });

  it("falls back to session app-db env when chat is missing", async () => {
    const env = await resolveSessionEnv("missing");
    assert.equal(env.containerEnv.SESSION_DB, "db-for-missing");
    assert.deepEqual(env.byRepo, {});
    assert.ok(env.envKeyNames.includes("SESSION_DB"));
  });

  it("merges workspace params and per-repo project params", async () => {
    const env = await resolveSessionEnv("s-ws");
    assert.equal(
      env.containerEnv.DATABASE_URL,
      "postgresql://forge@postgres-apps/db"
    );
    assert.equal(env.containerEnv.JWT_SECRET, "s");
    assert.equal(env.containerEnv.PUBLIC_URL, "http://ws");
    assert.equal(env.containerEnv.HOST, undefined);
    assert.equal(env.byRepo.api?.API_ONLY, "1");
    assert.equal(env.byRepo.web?.WEB_ONLY, "2");
    assert.equal(env.byRepo.api?.PUBLIC_URL, "http://ws");
    assert.ok(env.envKeyNames.includes("API_ONLY"));
    assert.ok(env.envKeyNames.includes("WEB_ONLY"));
  });

  it("merges project params for non-workspace sessions", async () => {
    const env = await resolveSessionEnv("s-proj");
    assert.equal(env.containerEnv.SESSION_DB, "db-for-s-proj");
    assert.equal(env.containerEnv.API_ONLY, "1");
    assert.deepEqual(env.byRepo, {});
  });

  it("forgeProvidedKeysForWorkspace includes runtime and engine keys", async () => {
    const keys = await forgeProvidedKeysForWorkspace("ws1");
    assert.ok(keys.has("HOST"));
    assert.ok(keys.has("PORT"));
    assert.ok(keys.has("DATABASE_URL"));
    assert.ok(keys.has("MONGODB_URI"));
  });
});
