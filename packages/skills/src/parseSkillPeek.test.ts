import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSkillPeek } from "./parseSkillPeek.js";

describe("parseSkillPeek", () => {
  it("reads YAML frontmatter name and description", () => {
    const entry = parseSkillPeek({
      skillId: "playwright",
      peek: `---
name: Playwright
description: Browser screenshots and DOM via run_terminal.
---

# Body that must not appear
Long instructions here.
`
    });
    assert.deepEqual(entry, {
      skillId: "playwright",
      skillName: "Playwright",
      description: "Browser screenshots and DOM via run_terminal."
    });
  });

  it("falls back to heading and first paragraph", () => {
    const entry = parseSkillPeek({
      skillId: "foo",
      peek: "# Foo skill\n\nDo the foo thing quickly.\n\nMore body.\n"
    });
    assert.equal(entry.skillId, "foo");
    assert.equal(entry.skillName, "Foo skill");
    assert.equal(entry.description, "Do the foo thing quickly.");
  });
});
