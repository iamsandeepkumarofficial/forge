import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  listPackagedSkillIds,
  packagedSkillsRoot,
  peekAllPackagedSkills,
  peekPackagedSkill,
  readPackagedSkillBody
} from "./catalog.js";

describe("packaged skills catalog", () => {
  it("resolves bundled/ next to the package", () => {
    const root = packagedSkillsRoot();
    assert.equal(path.basename(root), "bundled");
    assert.equal(
      fs.existsSync(path.join(root, "playwright", "SKILL.md")),
      true
    );
  });

  it("lists playwright and peeks description only", () => {
    assert.ok(listPackagedSkillIds().includes("playwright"));
    const peek = peekPackagedSkill("playwright");
    assert.equal(peek?.skillId, "playwright");
    assert.match(peek?.description ?? "", /Browser|Playwright|screenshot/i);
    assert.equal(
      peekAllPackagedSkills().some((e) => e.skillId === "playwright"),
      true
    );
  });

  it("reads full SKILL.md body", () => {
    const body = readPackagedSkillBody("playwright");
    assert.match(body ?? "", /npx playwright screenshot/);
    assert.equal(readPackagedSkillBody("missing-skill"), null);
  });
});
