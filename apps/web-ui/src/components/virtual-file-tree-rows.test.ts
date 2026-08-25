import { describe, it, expect } from "vitest";
import { buildTreeRows } from "./virtual-file-tree-rows";

describe("buildTreeRows", () => {
  it("emits loading row when cache is empty", () => {
    const { rows, pending } = buildTreeRows({
      cache: new Map(),
      loading: new Set(),
      errored: new Set(),
      isExpanded: () => true
    });
    expect(pending).toContain("");
    expect(rows[0]?.state).toBe("loading");
  });
});
