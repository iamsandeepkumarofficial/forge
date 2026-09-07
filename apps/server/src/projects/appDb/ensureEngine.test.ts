import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";
import { getAppDbEngine } from "./engines.js";

describe("ensureEngine", () => {
  let ensureEngineRunning: typeof import("./ensureEngine.js").ensureEngineRunning;
  let isEngineRunning: typeof import("./ensureEngine.js").isEngineRunning;
  let resolveEngineContainer: typeof import("./ensureEngine.js").resolveEngineContainer;
  let waitForPostgresReady: typeof import("./ensureEngine.js").waitForPostgresReady;

  const dockerCalls: string[][] = [];
  let inspectRunning: Record<string, boolean | "absent"> = {};
  let imagePresent = true;

  before(async () => {
    process.env.SANDBOX_RUNTIME = "docker";
    mock.module("node:child_process", {
      namedExports: {
        execFile: (
          _cmd: string,
          args: string[],
          _opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
          dockerCalls.push([...args]);
          const done = (err: Error | null, stdout = "", stderr = "") => {
            if (typeof cb === "function") cb(err, stdout, stderr);
            return Promise.resolve({ stdout, stderr });
          };
          if (args[0] === "inspect" && args[1] === "-f") {
            const container = args[3]!;
            const state = inspectRunning[container];
            if (state === "absent" || state === undefined) {
              return done(new Error("No such container"));
            }
            return done(null, state ? "true\n" : "false\n");
          }
          if (args[0] === "network" && args[1] === "inspect") {
            return done(null, "[]");
          }
          if (args[0] === "image" && args[1] === "inspect") {
            return imagePresent ? done(null, "{}") : done(new Error("missing"));
          }
          if (args[0] === "volume" && args[1] === "inspect") {
            return done(new Error("missing"));
          }
          if (args[0] === "exec" && args.includes("pg_isready")) {
            return done(null, "accepting");
          }
          return done(null, "");
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
                  args: string[],
                  opts: unknown,
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
      ensureEngineRunning,
      isEngineRunning,
      resolveEngineContainer,
      waitForPostgresReady
    } = await import("./ensureEngine.js"));
  });

  it("reuses a running container", async () => {
    dockerCalls.length = 0;
    const engine = getAppDbEngine("postgres")!;
    inspectRunning = { [engine.containerName]: true };
    const result = await ensureEngineRunning(engine);
    assert.equal(result.reused, true);
    assert.equal(result.pulled, false);
    assert.equal(result.containerName, engine.containerName);
  });

  it("starts a stopped container", async () => {
    dockerCalls.length = 0;
    const engine = getAppDbEngine("postgres")!;
    inspectRunning = { [engine.containerName]: false };
    const result = await ensureEngineRunning(engine);
    assert.equal(result.reused, true);
    assert.ok(dockerCalls.some((c) => c[0] === "start"));
  });

  it("creates container when absent", async () => {
    dockerCalls.length = 0;
    const engine = getAppDbEngine("mongo")!;
    inspectRunning = {};
    for (const n of [engine.containerName, ...engine.legacyContainerNames]) {
      inspectRunning[n] = "absent";
    }
    imagePresent = true;
    const result = await ensureEngineRunning(engine);
    assert.equal(result.reused, false);
    assert.equal(result.pulled, false);
    assert.ok(dockerCalls.some((c) => c[0] === "run"));
    assert.ok(dockerCalls.some((c) => c[0] === "volume" && c[1] === "create"));
  });

  it("isEngineRunning and resolveEngineContainer reflect state", async () => {
    const engine = getAppDbEngine("postgres")!;
    inspectRunning = { [engine.containerName]: true };
    assert.equal(await isEngineRunning(engine), true);
    assert.equal(await resolveEngineContainer(engine), engine.containerName);

    inspectRunning = {};
    assert.equal(await isEngineRunning(engine), false);
    assert.equal(await resolveEngineContainer(engine), null);
  });

  it("waitForPostgresReady succeeds when pg_isready ok", async () => {
    await waitForPostgresReady({
      containerName: "c1",
      user: "forge",
      attempts: 2
    });
  });
});
