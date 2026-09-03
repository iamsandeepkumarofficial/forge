import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IPC_PREVIEW_LOAD,
  IPC_PREVIEW_OVERFLOW_MENU,
  IPC_PREVIEW_SET_BOUNDS,
  IPC_PREVIEW_DT_VISIBLE
} from "./types.js";

describe("previewIpc channels", () => {
  it("keeps preview IPC names stable", () => {
    assert.equal(IPC_PREVIEW_SET_BOUNDS, "preview:setBounds");
    assert.equal(IPC_PREVIEW_LOAD, "preview:loadURL");
    assert.equal(IPC_PREVIEW_DT_VISIBLE, "preview:setDevtoolsVisible");
    assert.equal(IPC_PREVIEW_OVERFLOW_MENU, "preview:overflowMenu");
  });
});
