import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTmuxWindowLine,
  parseTmuxWindowList
} from "./sessionPty.js";

describe("sessionPty", () => {
  it("parses tmux list-windows format lines", () => {
    assert.deepEqual(parseTmuxWindowLine("1:main:1"), {
      windowId: "1",
      name: "main",
      active: true
    });
    assert.deepEqual(parseTmuxWindowLine("2:sh-abc:0"), {
      windowId: "2",
      name: "sh-abc",
      active: false
    });
    assert.deepEqual(parseTmuxWindowLine("3:my:weird:name:1"), {
      windowId: "3",
      name: "my:weird:name",
      active: true
    });
    assert.equal(parseTmuxWindowLine(""), null);
    assert.equal(parseTmuxWindowLine("bad"), null);
  });

  it("parses multiline tmux output", () => {
    assert.deepEqual(
      parseTmuxWindowList("1:main:1\n2:sh-abc:0\n\n"),
      [
        { windowId: "1", name: "main", active: true },
        { windowId: "2", name: "sh-abc", active: false }
      ]
    );
  });
});
