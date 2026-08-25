import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDuckDuckGoHtml } from "./duckduckgo.js";
const FIXTURE = `
<html><body>
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Domain</a>
  <a class="result__snippet">This domain is for use in illustrative examples.</a>
  <a class="result__a" href="https://docs.example.org/guide">Docs Guide</a>
  <a class="result__snippet">Official documentation.</a>
</body></html>
`;
describe("parseDuckDuckGoHtml", () => {
  it("extracts ranked title/url/snippet", () => {
    const results = parseDuckDuckGoHtml(FIXTURE, 5);
    assert.equal(results.length, 2);
    assert.equal(results[0]!.rank, 1);
    assert.equal(results[0]!.title, "Example Domain");
    assert.equal(results[0]!.url, "https://example.com/page");
    assert.match(results[0]!.snippet, /illustrative/);
    assert.equal(results[1]!.url, "https://docs.example.org/guide");
  });
  it("respects maxResults", () => {
    assert.equal(parseDuckDuckGoHtml(FIXTURE, 1).length, 1);
  });
  it("returns empty for unparseable html", () => {
    assert.equal(parseDuckDuckGoHtml("<html></html>", 5).length, 0);
  });
});
