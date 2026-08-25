import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGithubSlug } from "./slug.js";
describe("parseGithubSlug", () => {
  it("parses owner/repo", () => {
    assert.deepEqual(parseGithubSlug("octocat/Hello-World"), {
      owner: "octocat",
      repo: "Hello-World"
    });
  });
  it("parses https URL", () => {
    assert.deepEqual(parseGithubSlug("https://github.com/foo/bar.git"), {
      owner: "foo",
      repo: "bar"
    });
  });
  it("returns null for invalid slug", () => {
    assert.equal(parseGithubSlug("not-a-slug"), null);
  });
});
