import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripToText, shSingleQuote } from "./playwrightFetchHelpers.js";

describe("playwrightFetchHelpers", () => {
  it("stripToText removes tags and scripts", () => {
    const text = stripToText(
      "<html><script>x()</script><style>.a{}</style><p>Hello&nbsp;world</p></html>"
    );
    assert.equal(text, "Hello world");
  });

  it("shSingleQuote escapes single quotes", () => {
    assert.equal(shSingleQuote("a'b"), `'a'\\''b'`);
  });
});
