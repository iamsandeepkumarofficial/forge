import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectEcosystemEvidence,
  detectPackageManager,
  factsHaveNodeEvidence,
  readRepoFactsFromHost,
  suggestSkillsForFacts
} from "./repoFacts.js";

describe("repoFacts", () => {
  it("detects pnpm from lockfile", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-facts-"));
    try {
      fs.writeFileSync(path.join(dir, "package.json"), '{"name":"a"}');
      fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "");
      assert.equal(detectPackageManager(dir), "pnpm");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("suggests nextjs-app for next dep", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-facts-"));
    try {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "web",
          scripts: { dev: "next dev" },
          dependencies: { next: "14.0.0" }
        })
      );
      const facts = readRepoFactsFromHost({ rootPath: dir });
      assert.ok(facts.suggestedSkills.includes("nextjs-app"));
      assert.ok(facts.suggestedSkills.includes("frontend-app"));
      assert.ok(factsHaveNodeEvidence(facts));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("collects python ecosystem evidence without package.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-facts-"));
    try {
      fs.writeFileSync(path.join(dir, "requirements.txt"), "flask==3.0\n");
      const facts = readRepoFactsFromHost({ rootPath: dir });
      assert.equal(facts.hasPackageJson, false);
      assert.ok(facts.ecosystemEvidence.some((e) => e.ecosystem === "python"));
      assert.equal(factsHaveNodeEvidence(facts), false);
      const ev = collectEcosystemEvidence(dir);
      assert.ok(ev.some((e) => e.packageManagerGuess === "pip"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses .env.example into keys and values", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-facts-"));
    try {
      fs.writeFileSync(path.join(dir, "package.json"), '{"name":"a"}');
      fs.writeFileSync(
        path.join(dir, ".env.example"),
        "# comment\nJWT_SECRET=changeme\nPORT=3000\n"
      );
      const facts = readRepoFactsFromHost({ rootPath: dir });
      assert.ok(facts.envKeysReferenced.includes("JWT_SECRET"));
      assert.equal(facts.envExampleValues.JWT_SECRET, "changeme");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks unanalyzable when path missing", () => {
    const facts = readRepoFactsFromHost({
      rootPath: "/nonexistent",
      analyzable: false
    });
    assert.equal(facts.analyzable, false);
    assert.deepEqual(suggestSkillsForFacts(facts), []);
    assert.deepEqual(facts.ecosystemEvidence, []);
  });
});
