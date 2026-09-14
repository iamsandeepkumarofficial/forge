import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coerceNodeInstallVersion,
  NODE_DEFAULT_MAJOR,
  NODE_VERSION_PINS,
  resolveNodeArchive
} from "./install.js";

describe("node install facet", () => {
  it("coerces major and ranges to pins", () => {
    assert.equal(
      coerceNodeInstallVersion("20"),
      NODE_VERSION_PINS[NODE_DEFAULT_MAJOR]
    );
    assert.equal(coerceNodeInstallVersion("20.20.2"), "20.20.2");
    assert.equal(coerceNodeInstallVersion(">=18 <20"), NODE_VERSION_PINS[18]);
  });

  it("resolves a downloadable archive for darwin", () => {
    const archive = resolveNodeArchive({
      platform: "darwin",
      arch: "arm64",
      version: "20"
    });
    assert.ok(archive);
    assert.match(archive!.url, /nodejs\.org/);
    assert.match(archive!.fileName, /darwin-arm64/);
  });
});
