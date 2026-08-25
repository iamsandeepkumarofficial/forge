import { describe, it, expect } from "vitest";
import { ROW_H, OVERSCAN } from "./virtual-file-tree-types";

describe("virtual-file-tree-types", () => {
  it("exposes row metrics", () => {
    expect(ROW_H).toBeGreaterThan(0);
    expect(OVERSCAN).toBeGreaterThan(0);
  });
});
