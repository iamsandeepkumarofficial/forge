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

  it("lists packaged skills including stack pack", () => {
    const ids = listPackagedSkillIds();
    assert.ok(ids.includes("playwright"));
    for (const id of [
      "frontend-app",
      "backend-app",
      "nodejs-app",
      "python-app",
      "reactjs-app",
      "nextjs-app",
      "vuejs-app",
      "db-migrations"
    ]) {
      assert.ok(ids.includes(id), `missing skill ${id}`);
      const peek = peekPackagedSkill(id);
      assert.ok(peek?.description?.length);
      assert.ok(readPackagedSkillBody(id)?.includes("#"));
    }
  });

  it("python-app allows toolchain install after user approval", () => {
    const body = readPackagedSkillBody("python-app") ?? "";
    assert.match(body, /user approval/i);
    assert.match(body, /Propose/i);
    assert.doesNotMatch(body, /cannot run Python backends yet/i);
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
