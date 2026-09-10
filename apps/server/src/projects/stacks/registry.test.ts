import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  collectEcosystemEvidence,
  detectRuntimeRequirements,
  detectStack,
  extractRuntimeVersionFromOutput,
  factsHaveNodeEvidence,
  factsHavePythonEvidence,
  requiredHostTools,
  suggestSkillsForFacts
} from "./registry.js";
import { versionSatisfiesRange } from "../versionSatisfy.js";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "forge-stacks-"));
  tmpDirs.push(d);
  return d;
}

describe("detectRuntimeRequirements", () => {
  it("reads engines.node", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ engines: { node: ">=18 <20" } })
    );
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0]?.tool, "node");
    assert.equal(reqs[0]?.range, ">=18 <20");
    assert.match(reqs[0]?.source ?? "", /engines\.node/);
  });

  it("prefers .nvmrc over engines", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ engines: { node: ">=20" } })
    );
    fs.writeFileSync(path.join(root, ".nvmrc"), "18.20.0\n");
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs[0]?.range, "18.20.0");
    assert.equal(reqs[0]?.source, ".nvmrc");
  });

  it("infers Node range from next when engines missing", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "^13.4.7" } })
    );
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs[0]?.tool, "node");
    assert.equal(reqs[0]?.range, ">=16.14 <22");
    assert.match(reqs[0]?.source ?? "", /inferred from next/);
    assert.equal(
      versionSatisfiesRange("26.5.1", reqs[0]!.range),
      false,
      "Node 26 should fail Next 13 inferred range"
    );
    assert.equal(versionSatisfiesRange("20.11.1", reqs[0]!.range), true);
  });

  it("infers Node major from @types/node", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@types/node": "^20.3.2" } })
    );
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs[0]?.range, ">=20 <21");
  });

  it("reads pyproject requires-python", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "pyproject.toml"),
      '[project]\nrequires-python = ">=3.11,<3.13"\n'
    );
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs[0]?.tool, "python");
    assert.equal(reqs[0]?.range, ">=3.11,<3.13");
  });

  it("reads go.mod go directive", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, "go.mod"),
      "module example.com/a\n\ngo 1.22\n"
    );
    const reqs = detectRuntimeRequirements(root);
    assert.equal(reqs[0]?.tool, "go");
    assert.equal(reqs[0]?.range, ">=1.22");
  });
});

describe("stack registry", () => {
  it("merges node and python evidence", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(path.join(root, "requirements.txt"), "flask\n");
    const ev = collectEcosystemEvidence(root);
    assert.ok(ev.some((e) => e.ecosystem === "node"));
    assert.ok(ev.some((e) => e.ecosystem === "python"));
    const tags = detectStack(root);
    assert.ok(tags.includes("python"));
  });

  it("requiredHostTools defaults to node when no stack", () => {
    assert.deepEqual(requiredHostTools([]), ["git", "node"]);
  });

  it("requiredHostTools uses python3 hostBinary", () => {
    assert.deepEqual(
      requiredHostTools([{ ecosystemEvidence: [{ ecosystem: "python" }] }]),
      ["git", "python3"]
    );
  });

  it("suggests skills from stack signals", () => {
    const skills = suggestSkillsForFacts({
      ecosystemEvidence: [
        { ecosystem: "node", manifests: ["package.json"], lockfiles: [] }
      ],
      hasPackageJson: true,
      packageManager: "pnpm",
      scripts: ["dev"],
      detectedStack: ["next", "prisma"],
      envKeysReferenced: ["DATABASE_URL"]
    });
    assert.ok(skills.includes("nextjs-app"));
    assert.ok(skills.includes("frontend-app"));
    assert.ok(skills.includes("db-migrations"));
  });

  it("factsHave* wrappers", () => {
    assert.equal(
      factsHaveNodeEvidence({
        ecosystemEvidence: [{ ecosystem: "node" }],
        hasPackageJson: true
      }),
      true
    );
    assert.equal(
      factsHavePythonEvidence({
        ecosystemEvidence: [
          { ecosystem: "python", manifests: ["pyproject.toml"], lockfiles: [] }
        ],
        detectedStack: ["fastapi"]
      }),
      true
    );
  });
});

describe("extractRuntimeVersionFromOutput", () => {
  it("parses node -v", () => {
    assert.equal(
      extractRuntimeVersionFromOutput("node", "v20.11.1\n"),
      "20.11.1"
    );
  });

  it("parses python3 --version", () => {
    assert.equal(
      extractRuntimeVersionFromOutput("python", "Python 3.11.4\n"),
      "3.11.4"
    );
  });
});
