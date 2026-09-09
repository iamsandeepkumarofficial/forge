import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("backgroundJob", { concurrency: false }, () => {
  let running = false;
  let tcpOpen = false;
  let startJobScript: typeof import("./backgroundJob.js").startJobScript;
  let sanitizeJobName: typeof import("./backgroundJob.js").sanitizeJobName;
  let jobPidFile: typeof import("./backgroundJob.js").jobPidFile;
  let freeListeningPortScript: typeof import("./backgroundJob.js").freeListeningPortScript;
  let freeListeningPortHostScript: typeof import("./backgroundJob.js").freeListeningPortHostScript;
  let waitUntilJobRunning: typeof import("./backgroundJob.js").waitUntilJobRunning;
  let waitUntilTcpListening: typeof import("./backgroundJob.js").waitUntilTcpListening;

  before(async () => {
    mock.module("./sandboxExec.js", {
      exports: {
        dockerExec: async (opts: { argv: string[] }) => {
          const script = opts.argv.join(" ");
          if (script.includes("/dev/tcp")) {
            return {
              code: 0,
              stdout: tcpOpen ? "1" : "0",
              stderr: ""
            };
          }
          return {
            code: 0,
            stdout: running ? "1" : "0",
            stderr: ""
          };
        }
      }
    });
    ({
      startJobScript,
      sanitizeJobName,
      jobPidFile,
      freeListeningPortScript,
      freeListeningPortHostScript,
      waitUntilJobRunning,
      waitUntilTcpListening
    } = await import("./backgroundJob.js"));
  });

  it("startJobScript logs cwd failures before writing pid", () => {
    const script = startJobScript();
    assert.match(script, /: > "\$LOG"/);
    assert.match(script, /cwd not found/);
    assert.match(script, /printf '\$ %s\\n' "\$CMD"/);
    const logIdx = script.indexOf(': > "$LOG"');
    const cmdIdx = script.indexOf("printf");
    const pidIdx = script.indexOf('echo $$ > "$PID"');
    assert.ok(logIdx >= 0 && cmdIdx > logIdx && pidIdx > cmdIdx);
  });

  it("sanitizeJobName and pid paths stay under /tmp", () => {
    assert.equal(sanitizeJobName("next-dev"), "next-dev");
    assert.equal(
      jobPidFile({ kind: "app", name: "next-dev" }),
      "/tmp/forge-app-next-dev.pid"
    );
    assert.equal(
      jobPidFile({ kind: "term", name: "t1" }),
      "/tmp/forge-term-t1.pid"
    );
  });

  it("freeListeningPortScript targets the port via /proc inodes", () => {
    const script = freeListeningPortScript(3001);
    assert.match(script, /port=3001/);
    assert.match(script, /\/proc\/net\/tcp/);
    assert.match(script, /socket:\[\$inode\]/);
    assert.match(script, /kill -KILL/);
  });

  it("freeListeningPortHostScript prefers lsof then falls back to /proc", () => {
    const script = freeListeningPortHostScript(3001);
    assert.match(script, /port=3001/);
    assert.match(script, /lsof -nP -iTCP:"\$port"/);
    assert.match(script, /kill_pids TERM/);
    assert.match(script, /kill_pids KILL/);
    assert.match(script, /\/proc\/net\/tcp/);
  });

  it("waitUntilJobRunning returns false then true", async () => {
    running = false;
    assert.equal(
      await waitUntilJobRunning({
        containerName: "c",
        kind: "app",
        name: "web",
        tries: 2,
        intervalMs: 0
      }),
      false
    );
    running = true;
    assert.equal(
      await waitUntilJobRunning({
        containerName: "c",
        kind: "term",
        name: "t1",
        tries: 2,
        intervalMs: 0
      }),
      true
    );
  });

  it("waitUntilTcpListening polls until port opens", async () => {
    tcpOpen = false;
    assert.equal(
      await waitUntilTcpListening({
        containerName: "c",
        port: 3000,
        tries: 2,
        intervalMs: 0
      }),
      false
    );
    tcpOpen = true;
    assert.equal(
      await waitUntilTcpListening({
        containerName: "c",
        port: 3000,
        tries: 2,
        intervalMs: 0
      }),
      true
    );
  });
});
