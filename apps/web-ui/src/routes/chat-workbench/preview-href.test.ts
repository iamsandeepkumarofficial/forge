import { describe, it, expect } from "vitest";
import { previewHrefFor } from "./preview-href";

describe("previewHrefFor", () => {
  it("builds http href", () => {
    expect(
      previewHrefFor({
        appUrl: "http://app.test",
        surface: "browser",
        active: undefined
      })
    ).toBe("http://app.test");
  });
});
