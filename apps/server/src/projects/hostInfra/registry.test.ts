import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentHostArch,
  dependencyIdAliasHint,
  getProjectInfraDependency,
  listProjectInfraDependencyIds
} from "./registry.js";

describe("hostInfra registry", () => {
  it("lists known dependency ids including node", () => {
    const ids = listProjectInfraDependencyIds();
    assert.ok(ids.includes("node"));
    assert.ok(ids.includes("mongo"));
    assert.ok(ids.includes("postgres"));
    assert.ok(!ids.includes("python"));
  });

  it("looks up dependencies case-insensitively", () => {
    const mongo = getProjectInfraDependency("Mongo");
    const missing = getProjectInfraDependency("redis");
    assert.ok(mongo);
    assert.equal(mongo!.id, "mongo");
    assert.equal(missing, null);
  });

  it("rejects node-20 style ids with a hint", () => {
    assert.equal(getProjectInfraDependency("node-20"), null);
    assert.match(
      dependencyIdAliasHint("node-20") ?? "",
      /dependencyId=`node`.*version=`20`/
    );
  });

  it("resolves node archive for darwin arm64 with major pin", () => {
    const node = getProjectInfraDependency("node");
    assert.ok(node);
    const a = node!.resolveArchive({
      platform: "darwin",
      arch: "arm64",
      version: "20"
    });
    assert.ok(a);
    assert.equal(a!.version, "20.20.2");
    assert.match(a!.url, /nodejs\.org\/dist\/v20\.20\.2/);
    assert.match(a!.fileName, /darwin-arm64/);
  });

  it("resolves mongo and postgres archives for darwin arm64", () => {
    const mongo = getProjectInfraDependency("mongo");
    const pg = getProjectInfraDependency("postgres");
    assert.ok(mongo);
    assert.ok(pg);
    const m = mongo!.resolveArchive({
      platform: "darwin",
      arch: "arm64"
    });
    const p = pg!.resolveArchive({
      platform: "darwin",
      arch: "arm64"
    });
    assert.match(m!.url, /fastdl\.mongodb\.org/);
    assert.match(m!.fileName, /mongodb-macos-arm64/);
    assert.match(p!.url, /postgresql-binaries/);
    assert.match(p!.fileName, /aarch64-apple-darwin/);
  });

  it("resolves linux x86_64 archives", () => {
    const mongo = getProjectInfraDependency("mongo");
    const pg = getProjectInfraDependency("postgres");
    assert.ok(mongo);
    assert.ok(pg);
    const m = mongo!.resolveArchive({
      platform: "linux",
      arch: "x64"
    });
    const p = pg!.resolveArchive({
      platform: "linux",
      arch: "x64"
    });
    assert.match(m!.url, /fastdl\.mongodb\.org\/linux/);
    assert.match(p!.fileName, /x86_64-unknown-linux-gnu/);
  });

  it("returns null archives for unsupported platforms", () => {
    const mongo = getProjectInfraDependency("mongo");
    assert.ok(mongo);
    assert.equal(
      mongo!.resolveArchive({ platform: "win32", arch: "x64" }),
      null
    );
  });

  it("exposes currentHostArch", () => {
    assert.equal(typeof currentHostArch(), "string");
    assert.ok(currentHostArch().length > 0);
  });
});
