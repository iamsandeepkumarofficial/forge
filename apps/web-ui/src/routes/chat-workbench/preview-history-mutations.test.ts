import { describe, it, expect, vi } from "vitest";
import { goPreviewHistory } from "./preview-history-mutations";

describe("goPreviewHistory", () => {
  it("sets address from history", () => {
    const setAddress = vi.fn();
    goPreviewHistory({
      index: 0,
      history: ["http://a/"],
      surface: "browser",
      setHistIndex: vi.fn(),
      setAddress,
      setApiPath: vi.fn()
    });
    expect(setAddress).toHaveBeenCalledWith("http://a/");
  });
});
