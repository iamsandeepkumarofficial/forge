import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  assertProfileDeniesSsh,
  buildBwrapArgv,
  buildSeatbeltArgv,
  defaultWritableRoots,
  hostSandboxEnabled,
  materializeSeatbeltProfile,
  wrapHostCommand
} from "./osSandbox.js";

describe("osSandbox", () => {
  const prev = process.env.FORGE_HOST_SANDBOX;
  let tmp = "";

  afterEach(async () => {
    if (prev === undefined) delete process.env.FORGE_HOST_SANDBOX;
    else process.env.FORGE_HOST_SANDBOX = prev;
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("respects FORGE_HOST_SANDBOX=0", async () => {
    process.env.FORGE_HOST_SANDBOX = "0";
    assert.equal(hostSandboxEnabled(), false);
    const r = await wrapHostCommand({
      argv: ["echo", "hi"],
      sessionRoot: os.tmpdir(),
      cwd: os.tmpdir(),
      platform: "darwin"
    });
    assert.equal(r.enabled, false);
    assert.deepEqual(r.argv, ["echo", "hi"]);
  });

  it("builds seatbelt argv and denies ssh in materialized profile", async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-sb-"));
    const sessionRoot = path.join(tmp, "session");
    await fs.mkdir(path.join(sessionRoot, ".forge-runtime"), {
      recursive: true
    });
    const roots = defaultWritableRoots(sessionRoot);
    const profilePath = path.join(sessionRoot, ".forge-runtime", "seatbelt.sb");
    await materializeSeatbeltProfile({ writableRoots: roots, profilePath });
    const body = await fs.readFile(profilePath, "utf8");
    assert.ok(body.includes(sessionRoot));
    assert.ok(assertProfileDeniesSsh(body));
    const argv = buildSeatbeltArgv({
      argv: ["touch", path.join(sessionRoot, "x")],
      profilePath
    });
    assert.equal(argv[0], "sandbox-exec");
    assert.ok(argv.includes(profilePath));
  });

  it("builds bwrap argv with bind-try for writable roots", () => {
    const root = "/tmp/forge-session";
    const argv = buildBwrapArgv({
      argv: ["node", "-e", "1"],
      writableRoots: [root],
      cwd: root
    });
    assert.equal(argv[0], "bwrap");
    assert.ok(argv.includes("--bind-try"));
    assert.ok(argv.includes(root));
    assert.ok(argv.includes("--chdir"));
  });

  it("wrapHostCommand enables darwin seatbelt when sandbox on", async () => {
    delete process.env.FORGE_HOST_SANDBOX;
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "forge-sb2-"));
    const sessionRoot = path.join(tmp, "session");
    await fs.mkdir(path.join(sessionRoot, ".forge-runtime"), {
      recursive: true
    });
    const r = await wrapHostCommand({
      argv: ["true"],
      sessionRoot,
      cwd: sessionRoot,
      platform: "darwin"
    });
    assert.equal(r.enabled, true);
    assert.equal(r.argv[0], "sandbox-exec");
  });

  it("wrapHostCommand skips win32 with guidance", async () => {
    delete process.env.FORGE_HOST_SANDBOX;
    const r = await wrapHostCommand({
      argv: ["true"],
      sessionRoot: os.tmpdir(),
      cwd: os.tmpdir(),
      platform: "win32"
    });
    assert.equal(r.enabled, false);
    assert.match(r.reason ?? "", /WSL2/);
  });
});
