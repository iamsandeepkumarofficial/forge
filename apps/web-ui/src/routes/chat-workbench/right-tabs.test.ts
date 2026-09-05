import { describe, it, expect } from "vitest";
import {
  PREVIEW_TAB_ID,
  closeDocTab,
  nextActiveAfterClose,
  tabLabel,
  upsertDocTab
} from "./right-tabs";
import type { FileTab } from "./types";

const fileA: FileTab = { id: "file:a.ts", kind: "file", path: "src/a.ts" };
const fileB: FileTab = { id: "file:b.ts", kind: "file", path: "src/b.ts" };

describe("right-tabs", () => {
  it("upserts a tab once and labels by basename", () => {
    const once = upsertDocTab([], fileA);
    expect(upsertDocTab(once, fileA)).toEqual(once);
    expect(tabLabel(fileA)).toBe("a.ts");
  });

  it("returns to preview after closing the last tab", () => {
    const remaining = closeDocTab([fileA], fileA.id);
    expect(remaining).toEqual([]);
    expect(
      nextActiveAfterClose({
        activeId: fileA.id,
        closedId: fileA.id,
        remaining
      })
    ).toBe(PREVIEW_TAB_ID);
  });

  it("activates the last remaining tab when closing the current one", () => {
    const remaining = closeDocTab([fileA, fileB], fileB.id);
    expect(
      nextActiveAfterClose({
        activeId: fileB.id,
        closedId: fileB.id,
        remaining
      })
    ).toBe(fileA.id);
  });
});
