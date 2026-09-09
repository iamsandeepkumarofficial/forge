import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { installProjectInfraDependency } from "./install.js";
import { forgeRuntimeBin } from "./paths.js";

describe("installProjectInfraDependency", () => {
  it("reuses existing runtime binaries without downloading", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-infra-"));
    try {
      const bin = forgeRuntimeBin(home);
      await mkdir(bin, { recursive: true });
      const mongod = join(bin, "mongod");
      await writeFile(mongod, "#!/bin/sh\necho ok\n");
      await chmod(mongod, 0o755);
      let fetched = 0;
      const result = await installProjectInfraDependency("mongo", {
        home,
        platform: "darwin",
        arch: "arm64",
        fetchImpl: (async () => {
          fetched += 1;
          return new Response(null, { status: 500 });
        }) as typeof fetch
      });
      assert.equal(result.reused, true);
      assert.equal(fetched, 0);
      assert.equal(result.binaries.mongod, mongod);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("downloads and links binaries from a fake tarball", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-infra-dl-"));
    const staging = await mkdtemp(join(tmpdir(), "forge-infra-tar-"));
    try {
      const { execFileSync } = await import("node:child_process");
      const pkg = join(staging, "pkg", "bin");
      await mkdir(pkg, { recursive: true });
      await writeFile(join(pkg, "mongod"), "#!/bin/sh\n");
      await chmod(join(pkg, "mongod"), 0o755);
      const tarPath = join(staging, "mongo.tgz");
      execFileSync("tar", ["-czf", tarPath, "-C", staging, "pkg"]);
      const tarBytes = await import("node:fs/promises").then((fs) =>
        fs.readFile(tarPath)
      );

      const result = await installProjectInfraDependency("mongo", {
        home,
        platform: "darwin",
        arch: "arm64",
        fetchImpl: (async () =>
          new Response(Readable.toWeb(Readable.from(tarBytes)) as BodyInit, {
            status: 200
          })) as typeof fetch
      });
      assert.equal(result.reused, false);
      assert.ok(result.binaries.mongod);
      const { existsSync } = await import("node:fs");
      assert.equal(existsSync(result.binaries.mongod), true);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(staging, { recursive: true, force: true });
    }
  });
});
