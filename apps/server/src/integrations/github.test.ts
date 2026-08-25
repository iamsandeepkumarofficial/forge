import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

describe("GitHubService", () => {
  it("createPr returns html_url from Octokit", async () => {
    mock.module("@octokit/rest", {
      exports: {
        Octokit: class {
          pulls = {
            create: async () => ({
              data: { html_url: "https://github.com/o/r/pull/1" }
            }),
            get: async () => ({ data: { number: 2, title: "t" } })
          };
        }
      }
    });
    const { GitHubService } = await import("./github.js");
    const svc = new GitHubService("token");
    const url = await svc.createPr({
      owner: "o",
      repo: "r",
      title: "t",
      head: "feat",
      base: "main",
      body: "b"
    });
    assert.equal(url, "https://github.com/o/r/pull/1");
    const pr = await svc.getPr({ owner: "o", repo: "r", prNumber: 2 });
    assert.match(pr, /"number": 2/);
  });
});
