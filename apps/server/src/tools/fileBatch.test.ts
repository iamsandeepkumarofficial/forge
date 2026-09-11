import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDeleteFilesArgs,
  parseEditFileArgs,
  parseMoveFilesArgs,
  parseTouchedFilesMetadata,
  parseWriteFileArgs,
  applyExactReplace
} from "./fileBatch.js";

describe("fileBatch", () => {
  it("parses batch and legacy write_file args", () => {
    assert.deepEqual(
      parseWriteFileArgs({ files: [{ path: "a.ts", content: "x" }] }).entries,
      [{ path: "a.ts", content: "x" }]
    );
    assert.deepEqual(
      parseWriteFileArgs({ path: "a.ts", content: "x" }).entries,
      [{ path: "a.ts", content: "x" }]
    );
  });

  it("parses edit, delete, and move batches", () => {
    assert.equal(
      parseEditFileArgs({
        files: [{ path: "a.ts", oldString: "a", newString: "b" }]
      }).entries[0]?.path,
      "a.ts"
    );
    assert.deepEqual(parseDeleteFilesArgs({ paths: ["a.ts", "b.ts"] }).paths, [
      "a.ts",
      "b.ts"
    ]);
    assert.deepEqual(
      parseMoveFilesArgs({ moves: [{ from: "a.ts", to: "b.ts" }] }).moves,
      [{ from: "a.ts", to: "b.ts" }]
    );
  });

  it("parses metadata.files", () => {
    assert.deepEqual(
      parseTouchedFilesMetadata([
        { path: "a.ts", op: "update", before: "old" },
        { path: "skip", op: "nope" }
      ]),
      [{ path: "a.ts", op: "update", before: "old" }]
    );
  });

  it("rejects empty and oversized batches", () => {
    assert.equal(
      parseWriteFileArgs({ files: [] }).error,
      "at least one file is required"
    );
    const files = Array.from({ length: 21 }, (_, i) => ({
      path: `${i}.ts`,
      content: "x"
    }));
    assert.match(
      parseWriteFileArgs({ files }).error ?? "",
      /at most 20 files per call/
    );
  });

  it("applies exact replace once or all", () => {
    assert.deepEqual(
      applyExactReplace({
        content: "aa",
        oldString: "a",
        newString: "b",
        replaceAll: false
      }),
      { updated: "ba" }
    );
    assert.deepEqual(
      applyExactReplace({
        content: "aa",
        oldString: "a",
        newString: "b",
        replaceAll: true
      }),
      { updated: "bb" }
    );
    assert.deepEqual(
      applyExactReplace({
        content: "x",
        oldString: "z",
        newString: "b",
        replaceAll: false
      }),
      { error: "Could not find the exact text to replace" }
    );
  });
});
