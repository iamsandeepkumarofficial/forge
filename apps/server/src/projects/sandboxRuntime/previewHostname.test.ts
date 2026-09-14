import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  cloudPreviewHostname,
  hostPreviewHostname
} from "./previewHostname.js";
import {
  allocateSessionPort,
  releaseSessionPorts,
  resetSessionPortRegistryForTests
} from "./sessionPortRegistry.js";
import { FIRST_APP_PORT } from "../sessionSandbox/constants.js";
import { sessionPreviewHostname } from "./hostnames.js";

describe("previewHostname", () => {
  afterEach(async () => {
    resetSessionPortRegistryForTests();
    await releaseSessionPorts("hn-sess").catch(() => undefined);
  });

  it("cloud primary is reserved 3000", () => {
    assert.equal(
      cloudPreviewHostname("hn-sess", FIRST_APP_PORT),
      sessionPreviewHostname("hn-sess")
    );
    assert.match(cloudPreviewHostname("hn-sess", 3001), /^p3001-s-hn-sess\./);
  });

  it("host primary is lowest allocated registry port", async () => {
    const a = await allocateSessionPort("hn-sess");
    const b = await allocateSessionPort("hn-sess");
    assert.equal(
      hostPreviewHostname("hn-sess", a),
      sessionPreviewHostname("hn-sess")
    );
    assert.match(
      hostPreviewHostname("hn-sess", b),
      new RegExp(`^p${b}-s-hn-sess\\.`)
    );
  });
});
