import { describe, it, expect } from "vitest";
import { githubErrorMessage } from "./github-repo-picker-api";

describe("github-repo-picker-api", () => {
  it("formats plain errors", () => {
    expect(githubErrorMessage(new Error("nope"))).toBe("nope");
  });
});
