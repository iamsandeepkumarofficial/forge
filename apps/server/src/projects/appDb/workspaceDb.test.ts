import { describe, it, mock, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { workspaceDbName } from "./engines.js";

describe("workspaceDb", () => {
  let provisionWorkspaceEngine: typeof import("./workspaceDb.js").provisionWorkspaceEngine;
  let ensureAttachedWorkspaceEngines: typeof import("./workspaceDb.js").ensureAttachedWorkspaceEngines;
  let listEngineStatuses: typeof import("./workspaceDb.js").listEngineStatuses;
  let detachWorkspaceEngine: typeof import("./workspaceDb.js").detachWorkspaceEngine;

  const prevEnabled = process.env.FORGE_APP_DB_ENABLED;
  let engineRunning = true;
  let ensureCalls = 0;
  const dockerArgs: string[][] = [];

  before(async () => {
    mock.module("./ensureEngine.js", {
      exports: {
        ensureEngineRunning: async (engine: { containerName: string }) => {
          ensureCalls += 1;
          return {
            engineId: "postgres",
            containerName: engine.containerName,
            networkAlias: "postgres-apps",
            reused: true,
            pulled: false
          };
        },
        isEngineRunning: async () => engineRunning,
        resolveEngineContainer: async (engine: { containerName: string }) =>
          engine.containerName,
        waitForPostgresReady: async () => undefined
      }
    });
    mock.module("node:child_process", {
      namedExports: {
        execFile: (
          _cmd: string,
          args: string[],
          _opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
          dockerArgs.push([...args]);
          const done = (err: Error | null, stdout = "") => {
            if (typeof cb === "function") cb(err, stdout, "");
          };
          if (args.includes("CREATE DATABASE")) {
            done(null, "");
            return;
          }
          if (String(args.join(" ")).includes("pg_database")) {
            done(null, "1\n");
            return;
          }
          if (args.includes("DROP DATABASE")) {
            done(null, "");
            return;
          }
          if (args.includes("mongosh")) {
            done(null, "ok");
            return;
          }
          done(null, "");
        }
      }
    });
    mock.module("node:util", {
      namedExports: {
        promisify: (fn: (...args: unknown[]) => unknown) => {
          return (...args: unknown[]) =>
            new Promise((resolve, reject) => {
              (
                fn as (
                  cmd: string,
                  a: string[],
                  o: unknown,
                  cb: (
                    err: Error | null,
                    stdout: string,
                    stderr: string
                  ) => void
                ) => void
              )(
                args[0] as string,
                args[1] as string[],
                args[2],
                (err, stdout, stderr) => {
                  if (err) reject(err);
                  else resolve({ stdout, stderr });
                }
              );
            });
        }
      }
    });
    ({
      provisionWorkspaceEngine,
      ensureAttachedWorkspaceEngines,
      listEngineStatuses,
      detachWorkspaceEngine
    } = await import("./workspaceDb.js"));
  });

  afterEach(() => {
    if (prevEnabled === undefined) delete process.env.FORGE_APP_DB_ENABLED;
    else process.env.FORGE_APP_DB_ENABLED = prevEnabled;
    ensureCalls = 0;
    dockerArgs.length = 0;
    engineRunning = true;
  });

  it("provisionWorkspaceEngine rejects when app db disabled", async () => {
    process.env.FORGE_APP_DB_ENABLED = "0";
    await assert.rejects(
      () =>
        provisionWorkspaceEngine({
          workspaceId: "ws1",
          engineId: "postgres"
        }),
      /disabled/
    );
  });

  it("provisions postgres with connection url", async () => {
    delete process.env.FORGE_APP_DB_ENABLED;
    const wsId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = await provisionWorkspaceEngine({
      workspaceId: wsId,
      engineId: "postgres"
    });
    assert.equal(result.engineId, "postgres");
    assert.equal(result.database, workspaceDbName(wsId));
    assert.equal(result.envKey, "DATABASE_URL");
    assert.match(result.connectionUrl, /postgresql:\/\//);
    assert.equal(ensureCalls, 1);
  });

  it("ensureAttachedWorkspaceEngines builds env map", async () => {
    delete process.env.FORGE_APP_DB_ENABLED;
    const env = await ensureAttachedWorkspaceEngines({
      workspaceId: "ws1",
      engineIds: ["postgres"]
    });
    assert.ok(env.DATABASE_URL);
  });

  it("ensureAttachedWorkspaceEngines returns empty when disabled", async () => {
    process.env.FORGE_APP_DB_ENABLED = "0";
    const env = await ensureAttachedWorkspaceEngines({
      workspaceId: "ws1",
      engineIds: ["postgres"]
    });
    assert.deepEqual(env, {});
  });

  it("listEngineStatuses reports attached engines", async () => {
    engineRunning = true;
    const rows = await listEngineStatuses({
      workspaceId: "ws1",
      attachedEngineIds: ["postgres"]
    });
    const pg = rows.find((r) => r.id === "postgres");
    assert.equal(pg?.attached, true);
    assert.equal(pg?.engineRunning, true);
    assert.ok(pg?.database);
    const mongo = rows.find((r) => r.id === "mongo");
    assert.equal(mongo?.attached, false);
    assert.equal(mongo?.database, null);
  });

  it("detachWorkspaceEngine drops postgres database", async () => {
    dockerArgs.length = 0;
    await detachWorkspaceEngine({
      workspaceId: "ws1",
      engineId: "postgres"
    });
    assert.ok(dockerArgs.some((a) => a.join(" ").includes("DROP DATABASE")));
  });
});
