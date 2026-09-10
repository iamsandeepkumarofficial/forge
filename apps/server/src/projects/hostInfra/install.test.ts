import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { installProjectInfraDependency } from "./install.js";
import {
  forgeRuntimeBinDirs,
  forgeRuntimeDepCurrent,
  withForgeRuntimePath
} from "./paths.js";
import {
  coerceNodeInstallVersion,
  NODE_VERSION_PINS
} from "../stacks/node/install.js";

describe("coerceNodeInstallVersion", () => {
  it("pins majors and defaults", () => {
    assert.equal(coerceNodeInstallVersion("20"), NODE_VERSION_PINS[20]);
    assert.equal(coerceNodeInstallVersion("v20"), NODE_VERSION_PINS[20]);
    assert.equal(coerceNodeInstallVersion(undefined), NODE_VERSION_PINS[20]);
    assert.equal(coerceNodeInstallVersion("20.11.1"), "20.11.1");
  });

  it("picks a pin that satisfies a Next-13-style range", () => {
    assert.equal(
      coerceNodeInstallVersion(">=16.14 <22"),
      NODE_VERSION_PINS[20]
    );
  });
});

describe("installProjectInfraDependency keep-folder", () => {
  it("reuses matching versioned node install", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-infra-"));
    try {
      const ver = NODE_VERSION_PINS[20]!;
      const root = join(home, ".forge", "runtime", "node", ver);
      const bin = join(root, "bin");
      await mkdir(bin, { recursive: true });
      const nodeBin = join(bin, "node");
      await writeFile(nodeBin, `#!/bin/sh\necho v${ver}\n`);
      await chmod(nodeBin, 0o755);
      await writeFile(join(bin, "npm"), "#!/bin/sh\n");
      await writeFile(join(bin, "npx"), "#!/bin/sh\n");
      await chmod(join(bin, "npm"), 0o755);
      await chmod(join(bin, "npx"), 0o755);

      let fetched = 0;
      const result = await installProjectInfraDependency("node", {
        home,
        platform: "darwin",
        arch: "arm64",
        version: "20",
        fetchImpl: (async () => {
          fetched += 1;
          return new Response(null, { status: 500 });
        }) as typeof fetch
      });
      assert.equal(result.reused, true);
      assert.equal(fetched, 0);
      assert.equal(result.version, ver);
      assert.ok(result.binaries.node);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("downloads and keeps node folder layout", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-infra-dl-"));
    const staging = await mkdtemp(join(tmpdir(), "forge-infra-tar-"));
    try {
      const { execFileSync } = await import("node:child_process");
      const ver = "20.11.1";
      const pkg = join(staging, `node-v${ver}-darwin-arm64`, "bin");
      await mkdir(pkg, { recursive: true });
      await writeFile(join(pkg, "node"), "#!/bin/sh\necho v20.11.1\n");
      await writeFile(join(pkg, "npm"), "#!/bin/sh\n");
      await writeFile(join(pkg, "npx"), "#!/bin/sh\n");
      await chmod(join(pkg, "node"), 0o755);
      await chmod(join(pkg, "npm"), 0o755);
      await chmod(join(pkg, "npx"), 0o755);
      const tarPath = join(staging, "node.tgz");
      execFileSync("tar", [
        "-czf",
        tarPath,
        "-C",
        staging,
        `node-v${ver}-darwin-arm64`
      ]);
      const tarBytes = await import("node:fs/promises").then((fs) =>
        fs.readFile(tarPath)
      );

      const result = await installProjectInfraDependency("node", {
        home,
        platform: "darwin",
        arch: "arm64",
        version: "20.11.1",
        fetchImpl: (async () =>
          new Response(Readable.toWeb(Readable.from(tarBytes)) as BodyInit, {
            status: 200
          })) as typeof fetch
      });
      assert.equal(result.reused, false);
      assert.equal(result.version, "20.11.1");
      assert.ok(result.binaries.node);
      const { existsSync } = await import("node:fs");
      assert.equal(existsSync(result.binaries.node), true);
      assert.equal(existsSync(forgeRuntimeDepCurrent("node", home)), true);
      const dirs = forgeRuntimeBinDirs(home);
      assert.ok(dirs.some((d) => d.includes("/node/current/bin")));
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("rejects node-20 dependency id", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-bad-"));
    try {
      await assert.rejects(
        () =>
          installProjectInfraDependency("node-20", {
            home,
            version: "20"
          }),
        /dependencyId=`node`/
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("withForgeRuntimePath", () => {
  it("prepends forge runtime bins", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-path-"));
    try {
      const bin = join(home, ".forge", "runtime", "node", "current", "bin");
      await mkdir(bin, { recursive: true });
      const path = withForgeRuntimePath("/usr/bin:/bin", home);
      assert.ok(path.startsWith(bin));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
