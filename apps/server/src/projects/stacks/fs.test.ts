import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { firstNonEmptyLine, readText } from "./fs.js";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("stacks/fs", () => {
  it("readText returns null for missing files", () => {
    assert.equal(readText(path.join(os.tmpdir(), "forge-missing-xyz")), null);
  });

  it("readText returns file contents", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "forge-stacks-fs-"));
    tmpDirs.push(d);
    const file = path.join(d, "a.txt");
    fs.writeFileSync(file, "hello");
    assert.equal(readText(file), "hello");
  });

  it("firstNonEmptyLine skips blanks and comments", () => {
    assert.equal(firstNonEmptyLine("# c\n\n  18.20.0\n"), "18.20.0");
  });
});
