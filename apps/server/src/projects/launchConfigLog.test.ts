import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLaunchAppNames } from "./launchConfigLog.js";

describe("launchConfigLog", () => {
  it("formats app names for log lines", () => {
    assert.equal(formatLaunchAppNames([]), "(none)");
    assert.equal(
      formatLaunchAppNames([
        { name: "web", cwd: ".", command: "npm run dev", type: "web" }
      ]),
      "web"
    );
    assert.equal(
      formatLaunchAppNames([
        { name: "api", cwd: ".", command: "npm run dev", type: "api" },
        { name: "web", cwd: ".", command: "npm run dev", type: "web" }
      ]),
      "api, web"
    );
  });
});
