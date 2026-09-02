import { describe, it, mock, before } from "node:test";
import assert from "node:assert/strict";

describe("sessionAppLog", { concurrency: false }, () => {
  let attachAppLogFollow: typeof import("./sessionAppLog.js").attachAppLogFollow;
  let attachJobLogFollow: typeof import("./sessionAppLog.js").attachJobLogFollow;
  const chunks: Buffer[] = [];
  let followClosed = false;
  let capturedTailLines = -1;
  let capturedKind = "";

  before(async () => {
    mock.module("./backgroundJob.js", {
      exports: {
        jobLogFile: (opts: { kind: string; name: string }) =>
          `/tmp/forge-${opts.kind}-${opts.name}.log`,
        isBackgroundJobRunning: async () => true
      }
    });
    mock.module("./dockerExecHttp.js", {
      exports: {
        dockerLogFollowAttach: async (options: {
          logPath: string;
          tailLines?: number;
          onData: (chunk: Buffer) => void;
          onClose: () => void;
        }) => {
          capturedTailLines = options.tailLines ?? 0;
          capturedKind = options.logPath.includes("forge-term-") ? "term" : "app";
          options.onData(Buffer.from("live\r\n"));
          return {
            close: () => {
              followClosed = true;
              options.onClose();
            }
          };
        }
      }
    });
    ({ attachAppLogFollow, attachJobLogFollow } = await import(
      "./sessionAppLog.js"
    ));
  });

  it("uses a single tail -F attach for app logs", async () => {
    chunks.length = 0;
    followClosed = false;
    const handle = await attachAppLogFollow({
      containerName: "c",
      appName: "web",
      onData: (chunk) => chunks.push(chunk),
      onExited: () => undefined
    });
    assert.equal(capturedTailLines, 500);
    assert.equal(capturedKind, "app");
    assert.equal(chunks.length, 1);
    handle.close();
    assert.equal(followClosed, true);
  });

  it("attaches job logs with term kind", async () => {
    chunks.length = 0;
    followClosed = false;
    const handle = await attachJobLogFollow({
      containerName: "c",
      jobName: "install",
      onData: (chunk) => chunks.push(chunk),
      onExited: () => undefined
    });
    assert.equal(capturedKind, "term");
    handle.close();
    assert.equal(followClosed, true);
  });
});
