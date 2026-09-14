import { describe, it, expect } from "vitest";
import { previewStageUrls } from "./preview-stage-fields";

describe("previewStageUrls", () => {
  it("marks browser visible when app url exists", () => {
    expect(
      previewStageUrls({
        surface: "browser",
        appUrl: "http://x",
        loadedUrl: "http://x"
      }).showBrowser
    ).toBe(true);
  });
});
