import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  persistExternalJobPid,
  STOP_HAD_PID_TOKEN,
  STOP_NO_PID_TOKEN,
  stopJobHadPid,
  stopJobScript
} from "./backgroundJobPid.js";

describe("backgroundJobPid", () => {
  it("stopJobScript kills the process group and children then reports pid state", () => {
    const script = stopJobScript("/tmp/forge-app-web.pid");
    assert.match(script, /kill -TERM -"\$P"/);
    assert.match(script, /pkill -TERM -P "\$P"/);
    assert.match(script, /pkill -KILL -P "\$P"/);
    assert.match(script, /\/tmp\/forge-app-web\.pid/);
    assert.match(script, new RegExp(STOP_HAD_PID_TOKEN));
    assert.match(script, new RegExp(STOP_NO_PID_TOKEN));
    assert.equal(stopJobHadPid(`${STOP_HAD_PID_TOKEN}\n`), true);
    assert.equal(stopJobHadPid(`${STOP_NO_PID_TOKEN}\n`), false);
  });

  it("persistExternalJobPid writes a spawn pid and rejects invalid values", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-job-pid-"));
    const pidFile = path.join(dir, "job.pid");
    try {
      assert.equal(
        await persistExternalJobPid({ pidFile, pid: undefined }),
        false
      );
      assert.equal(await persistExternalJobPid({ pidFile, pid: 0 }), false);
      assert.equal(await persistExternalJobPid({ pidFile, pid: 4242 }), true);
      assert.equal((await fs.readFile(pidFile, "utf8")).trim(), "4242");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
