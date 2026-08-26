import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  previewInProcessEnabled,
  previewListenPort
} from "./startInProcessPreview.js";

const ORIG = { ...process.env };

afterEach(() => {
  for (const key of [
    "PREVIEW_IN_PROCESS",
    "PREVIEW_PLANE_URL",
    "PREVIEW_PLANE_PORT"
  ]) {
    if (ORIG[key] === undefined) delete process.env[key];
    else process.env[key] = ORIG[key];
  }
});

describe("startInProcessPreview helpers", () => {
  it("defaults to in-process for local loopback", () => {
    delete process.env.PREVIEW_IN_PROCESS;
    delete process.env.PREVIEW_PLANE_URL;
    assert.equal(previewInProcessEnabled(), true);
  });

  it("stays in-process when PREVIEW_PLANE_URL is loopback", () => {
    delete process.env.PREVIEW_IN_PROCESS;
    process.env.PREVIEW_PLANE_URL = "http://127.0.0.1:8081";
    assert.equal(previewInProcessEnabled(), true);
  });

  it("disables when PREVIEW_IN_PROCESS=0", () => {
    process.env.PREVIEW_IN_PROCESS = "0";
    assert.equal(previewInProcessEnabled(), false);
  });

  it("disables for remote PREVIEW_PLANE_URL unless forced on", () => {
    delete process.env.PREVIEW_IN_PROCESS;
    process.env.PREVIEW_PLANE_URL = "http://preview.internal:8081";
    assert.equal(previewInProcessEnabled(), false);
    process.env.PREVIEW_IN_PROCESS = "1";
    assert.equal(previewInProcessEnabled(), true);
  });

  it("reads PREVIEW_PLANE_PORT", () => {
    process.env.PREVIEW_PLANE_PORT = "9090";
    assert.equal(previewListenPort(), 9090);
  });
});
