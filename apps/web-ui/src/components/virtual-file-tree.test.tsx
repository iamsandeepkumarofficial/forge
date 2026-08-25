import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VirtualFileTree, eagerChildrenFromPaths } from "./virtual-file-tree";

describe("eagerChildrenFromPaths", () => {
  it("builds tree entries from flat paths", async () => {
    const children = eagerChildrenFromPaths([
      { path: "src/a.ts" },
      { path: "src/b.ts" },
      { path: "readme.md" }
    ]);
    const root = await children("");
    expect(root.some((e) => e.name === "src" && e.isDir)).toBe(true);
    expect(root.some((e) => e.name === "readme.md" && !e.isDir)).toBe(true);
    const src = await children("src");
    expect(src.map((e) => e.name).sort()).toEqual(["a.ts", "b.ts"]);
  });
});

describe("VirtualFileTree", () => {
  it("loads root children and selects a file", async () => {
    const getChildren = vi.fn(async (path: string) => {
      if (path === "") {
        return [{ name: "a.ts", path: "a.ts", isDir: false }];
      }
      return [];
    });
    const onSelectFile = vi.fn();
    render(
      <VirtualFileTree getChildren={getChildren} onSelectFile={onSelectFile} />
    );
    await waitFor(() => {
      expect(screen.getByText("a.ts")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("a.ts"));
    expect(onSelectFile).toHaveBeenCalledWith("a.ts");
  });
});
