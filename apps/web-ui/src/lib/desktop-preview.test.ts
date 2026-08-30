import { describe, it, expect } from "vitest";
import { boundsFromRect, isUsableHole } from "./desktop-preview";

describe("desktop-preview", () => {
  it("boundsFromRect rounds and clamps size", () => {
    expect(
      boundsFromRect({
        left: 10.4,
        top: 20.6,
        width: 100.2,
        height: -1
      } as DOMRect)
    ).toEqual({ x: 10, y: 21, width: 100, height: 0 });
  });

  it("isUsableHole requires both dimensions", () => {
    expect(isUsableHole({ x: 0, y: 0, width: 0, height: 8 })).toBe(false);
    expect(isUsableHole({ x: 0, y: 0, width: 8, height: 8 })).toBe(true);
  });
});
