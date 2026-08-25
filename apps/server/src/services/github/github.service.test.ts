import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GithubService } from "./github.service.js";

describe("GithubService", () => {
  it("parseSlug delegates to parseGithubSlug", () => {
    const svc = new GithubService();
    assert.deepEqual(svc.parseSlug("acme/widgets"), {
      owner: "acme",
      repo: "widgets"
    });
    assert.equal(svc.parseSlug("not-a-slug"), null);
  });

  it("validateSlugFormat accepts owner/repo", () => {
    const svc = new GithubService();
    assert.equal(svc.validateSlugFormat("  org/repo-name  "), "org/repo-name");
  });

  it("validateSlugFormat rejects invalid shapes", () => {
    const svc = new GithubService();
    assert.throws(
      () => svc.validateSlugFormat("noslash"),
      /Invalid GitHub slug/
    );
    assert.throws(() => svc.validateSlugFormat("a/b/c"), /Invalid GitHub slug/);
    assert.throws(
      () => svc.validateSlugFormat("org/repo!"),
      /Invalid GitHub slug/
    );
  });
});
