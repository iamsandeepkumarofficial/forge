import { describe, expect, it, vi } from "vitest";
import { clearPreviewHistoryTo } from "./preview-history-nav";

describe("clearPreviewHistoryTo", () => {
  it("resets history to the current url", () => {
    const setHistory = vi.fn();
    const setHistIndex = vi.fn();
    const setAddress = vi.fn();
    clearPreviewHistoryTo({
      current: "http://localhost:3000/now",
      setHistory,
      setHistIndex,
      setAddress
    });
    expect(setHistory).toHaveBeenCalledWith(["http://localhost:3000/now"]);
    expect(setHistIndex).toHaveBeenCalledWith(0);
    expect(setAddress).toHaveBeenCalledWith("http://localhost:3000/now");
  });
});
