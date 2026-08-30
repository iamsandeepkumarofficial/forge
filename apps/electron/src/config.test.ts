import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  defaultHome,
  forgeConfigPath,
  readConfig,
  stopComposeOnQuit,
  writeConfig
} from "./config.js";

describe("config", () => {
  it("defaultHome prefers HOME then USERPROFILE", () => {
    assert.equal(defaultHome({ HOME: "/h" }), "/h");
    assert.equal(defaultHome({ USERPROFILE: "C:\\u" }), "C:\\u");
    assert.equal(defaultHome({}), ".");
  });

  it("readConfig returns defaults when missing", () => {
    const home = mkdtempSync(join(tmpdir(), "forge-cfg-"));
    const cfg = readConfig(home);
    assert.equal(cfg.desktop?.stopComposeOnQuit, true);
    assert.equal(cfg.llm?.apiKey, null);
  });

  it("writeConfig then readConfig round-trips", () => {
    const home = mkdtempSync(join(tmpdir(), "forge-cfgw-"));
    writeConfig({
      home,
      config: { desktop: { stopComposeOnQuit: false }, llm: { model: "x" } }
    });
    const path = forgeConfigPath(home);
    assert.match(readFileSync(path, "utf8"), /stopComposeOnQuit/);
    assert.equal(readConfig(home).llm?.model, "x");
    assert.equal(stopComposeOnQuit(readConfig(home)), false);
  });
});
