import { describe, expect, it } from "vitest";
import {
  archiveNameForFolder,
  entriesFromFileList,
  shouldIncludeProjectPath,
  zipProjectEntries
} from "./zip-project-files.js";
describe("shouldIncludeProjectPath", () => {
  it("keeps normal source files", () => {
    expect(shouldIncludeProjectPath("my-app/src/index.ts")).toBe(true);
  });
  it("skips node_modules and .git", () => {
    expect(shouldIncludeProjectPath("my-app/node_modules/foo/index.js")).toBe(
      false
    );
    expect(shouldIncludeProjectPath("my-app/.git/config")).toBe(false);
  });
  it("skips mac junk", () => {
    expect(shouldIncludeProjectPath("my-app/.DS_Store")).toBe(false);
    expect(shouldIncludeProjectPath("__MACOSX/._foo")).toBe(false);
  });
});
describe("entriesFromFileList", () => {
  it("uses webkitRelativePath and filters skips", () => {
    const keep = new File(["a"], "index.ts");
    Object.defineProperty(keep, "webkitRelativePath", {
      value: "app/src/index.ts"
    });
    const skip = new File(["b"], "index.js");
    Object.defineProperty(skip, "webkitRelativePath", {
      value: "app/node_modules/x/index.js"
    });
    const entries = entriesFromFileList([keep, skip]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.relativePath).toBe("app/src/index.ts");
  });
});
describe("zipProjectEntries", () => {
  it("builds a zip named after the folder", async () => {
    const file = new File(["hello"], "readme.md");
    const zip = await zipProjectEntries(
      [{ relativePath: "demo/readme.md", file }],
      archiveNameForFolder("demo")
    );
    expect(zip.name).toBe("demo.zip");
    expect(zip.type).toBe("application/zip");
    expect(zip.size).toBeGreaterThan(0);
  });
});
