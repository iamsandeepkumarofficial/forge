import { describe, it, expect } from "vitest";
import type { WebPreviewContentProps } from "./web-preview-content-props";

describe("web-preview-content-props", () => {
  it("describes the content panel contract", () => {
    const stub = {
      sessionId: "s1",
      surface: "browser"
    } as Partial<WebPreviewContentProps>;
    expect(stub.sessionId).toBe("s1");
    expect(stub.surface).toBe("browser");
  });
});
